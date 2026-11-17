// Module de surface : les mini-jeux, dessinés et joués dans le panneau.
// Il n'a pas accès à `$` : les scores partent vers le module de hooks avec `surface.post`.
import type { ClientKeyEvent, ClientModule, ClientSurface } from 'claude-code'

import type { GameId, GameProps } from '../types'

type Cell = readonly [number, number]
type Dir = 'up' | 'down' | 'left' | 'right'

export type Snake = {
  cols: number
  rows: number
  body: readonly Cell[]
  dir: Dir
  queue: readonly Dir[]
  food: Cell | null
  score: number
  isOver: boolean
  isWon: boolean
}

export type Typing = {
  text: string
  pos: number
  errors: number
  strokes: number
  startedAt: number
  endedAt: number
  isWrong: boolean
}

type State = {
  /** Jeu choisi avec Tab, valable tant que le jeu demandé par les props ne change pas. */
  override: GameId | null
  overrideFor: GameId
  /** Rien ne bouge avant qu'on appuie sur Espace. */
  isStarted: boolean
  isPaused: boolean
  snake: Snake
  typing: Typing
}

const TICK_MS = 40
const BOARD_ROWS = 10
const HEAD = '#b6f36a'
const BODY = '#3fa34d'
const FOOD = '#e5484d'

const MOVES: Record<Dir, Cell> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DIRECTION_KEYS: Record<string, Dir> = {
  up: 'up', down: 'down', left: 'left', right: 'right',
  z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right',
}

const TEXTS = [
  'git commit -m "corrige le bug du vendredi soir"',
  'git rebase -i HEAD~3',
  'git stash && git pull --rebase && git stash pop',
  'git log --oneline --graph --all',
  'docker compose up -d --build',
  'npm run test -- --watch',
  'php artisan migrate:fresh --seed',
  'composer require --dev pestphp/pest',
  'grep -rn "TODO" src/ | wc -l',
  'ssh -L 5432:localhost:5432 deploy@serveur',
  'const total = items.reduce((a, b) => a + b.price, 0);',
  'if (!user) return res.status(401).json({ error });',
  'for (const [key, value] of Object.entries(config)) {}',
  'SELECT id, email FROM users WHERE deleted_at IS NULL;',
  'export default async function handler(req, res) {}',
  'Chez moi, tout fonctionne parfaitement.',
  'Un bon commit explique pourquoi, pas comment.',
  'Les tests passent, donc on ne touche plus à rien.',
  'Il reste deux choses difficiles : nommer et invalider le cache.',
  'Portez ce vieux whisky au juge blond qui fume.',
  'Vendredi, seize heures : surtout pas de mise en production.',
  'Le plus dur dans ce ticket, ce fut de le comprendre.',
  'Dix minutes de lecture évitent deux heures de débogage.',
]

// Les écouteurs sont posés une seule fois : ils lisent les dernières props ici.
let latest: GameProps | undefined
let ticks = 0

// ---------- Snake ----------

function placeFood(snake: Pick<Snake, 'cols' | 'rows' | 'body'>, random: () => number): Cell | null {
  const taken = new Set(snake.body.map(([x, y]) => `${x},${y}`))
  const free: Cell[] = []
  for (let y = 0; y < snake.rows; y++) {
    for (let x = 0; x < snake.cols; x++) {
      if (!taken.has(`${x},${y}`)) free.push([x, y])
    }
  }

  return free[Math.floor(random() * free.length)] ?? null
}

export function newSnake(columns: number, random: () => number = Math.random): Snake {
  const cols = Math.max(8, Math.min(24, Math.floor((columns - 4) / 2)))
  const rows = BOARD_ROWS
  const cx = Math.floor(cols / 2)
  const cy = Math.floor(rows / 2)
  const body: Cell[] = [[cx, cy], [cx - 1, cy], [cx - 2, cy]]

  return {
    cols, rows, body,
    dir: 'right', queue: [],
    food: placeFood({ cols, rows, body }, random),
    score: 0, isOver: false, isWon: false,
  }
}

// Met un virage en file d'attente (2 max) pour ne perdre aucune touche entre deux pas.
export function turn(snake: Snake, dir: Dir): Snake {
  const last = snake.queue[snake.queue.length - 1] ?? snake.dir
  if (dir === last || dir === OPPOSITE[last] || snake.queue.length >= 2) return snake

  return { ...snake, queue: [...snake.queue, dir] }
}

export function step(snake: Snake, random: () => number = Math.random): Snake {
  if (snake.isOver) return snake
  const dir = snake.queue[0] ?? snake.dir
  const queue = snake.queue.slice(1)
  const head = snake.body[0] ?? [0, 0]
  const nx = head[0] + MOVES[dir][0]
  const ny = head[1] + MOVES[dir][1]
  const isEating = snake.food !== null && nx === snake.food[0] && ny === snake.food[1]
  // La queue libère sa case pendant le pas, sauf si le serpent grandit.
  const rest = isEating ? snake.body : snake.body.slice(0, -1)
  const isOutside = nx < 0 || ny < 0 || nx >= snake.cols || ny >= snake.rows
  if (isOutside || rest.some(([x, y]) => x === nx && y === ny)) {
    return { ...snake, dir, queue, isOver: true }
  }
  const body: Cell[] = [[nx, ny], ...rest]
  if (!isEating) return { ...snake, dir, queue, body }
  const food = placeFood({ cols: snake.cols, rows: snake.rows, body }, random)

  return { ...snake, dir, queue, body, food, score: snake.score + 1, isOver: food === null, isWon: food === null }
}

/** Nombre de battements entre deux pas : de 160 ms au départ à 80 ms. */
const stepEvery = (score: number) => Math.max(2, 4 - Math.floor(score / 6))

// ---------- Frappe ----------

export function newTyping(previous = '', random: () => number = Math.random): Typing {
  let text = previous
  while (text === previous) text = TEXTS[Math.floor(random() * TEXTS.length)] ?? previous

  return { text, pos: 0, errors: 0, strokes: 0, startedAt: 0, endedAt: 0, isWrong: false }
}

export function typeKey(typing: Typing, key: string, now: number): Typing {
  if (typing.endedAt !== 0) return typing
  const startedAt = typing.startedAt || now
  if (key !== typing.text[typing.pos]) {
    return { ...typing, startedAt, strokes: typing.strokes + 1, errors: typing.errors + 1, isWrong: true }
  }
  const pos = typing.pos + 1

  return {
    ...typing, startedAt, pos,
    strokes: typing.strokes + 1,
    isWrong: false,
    endedAt: pos === typing.text.length ? Math.max(now, startedAt + 1) : 0,
  }
}

/** Mots par minute, sur la base usuelle de 5 caractères par mot. */
export function wordsPerMinute(chars: number, ms: number): number {
  return ms > 0 ? Math.round(chars / 5 / (ms / 60000)) : 0
}

// Découpe en lignes sans couper les mots ; renvoie des intervalles [début, fin[.
export function wrap(text: string, width: number): [number, number][] {
  const ranges: [number, number][] = []
  let lineStart = 0
  let lastSpace = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') lastSpace = i
    if (i - lineStart >= width && lastSpace > lineStart) {
      ranges.push([lineStart, lastSpace + 1])
      lineStart = lastSpace + 1
    }
  }
  ranges.push([lineStart, text.length])

  return ranges
}

// ---------- État, clavier, horloge ----------

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))

  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`
}

const currentGame = (state: State, props: GameProps): GameId =>
  state.override !== null && state.overrideFor === props.game ? state.override : props.game

function initialState(props: GameProps): State {
  return {
    override: null,
    overrideFor: props.game,
    isStarted: false,
    isPaused: false,
    snake: newSnake(props.columns),
    typing: newTyping(),
  }
}

function onTick(surface: ClientSurface<State>): void {
  ticks += 1
  const state = surface.state
  if (state === undefined || latest === undefined) return
  const isSnakeRunning =
    currentGame(state, latest) === 'snake' &&
    state.isStarted && !state.isPaused && !latest.isCovered && !state.snake.isOver
  if (isSnakeRunning) {
    if (ticks % stepEvery(state.snake.score) !== 0) return
    const snake = step(state.snake)
    if (snake.isOver) surface.post({ game: 'snake', score: snake.score })
    surface.setState({ ...state, snake })
  } else if (ticks % 12 === 0) {
    surface.setState({ ...state }) // fait avancer les durées affichées
  }
}

function onKey(surface: ClientSurface<State>, event: ClientKeyEvent): void {
  const state = surface.state
  if (state === undefined || latest === undefined || event.ctrl || event.meta) return
  const key = event.key === 'space' ? ' ' : event.key
  const game = currentGame(state, latest)

  if (key === 'tab') {
    surface.setState({
      ...state,
      override: game === 'snake' ? 'typing' : 'snake',
      overrideFor: latest.game,
      isStarted: false,
      isPaused: false,
      snake: newSnake(latest.columns),
      typing: newTyping(state.typing.text),
    })

    return
  }
  if (!state.isStarted) {
    if (key === ' ') surface.setState({ ...state, isStarted: true })

    return
  }

  if (game === 'snake') {
    const { snake } = state
    const dir = DIRECTION_KEYS[key.toLowerCase()]
    if (key === ' ' || key === 'p') {
      if (!snake.isOver) surface.setState({ ...state, isPaused: !state.isPaused })
    } else if (key === 'return' || key === 'r') {
      if (snake.isOver) surface.setState({ ...state, isPaused: false, snake: newSnake(latest.columns) })
    } else if (dir !== undefined && !state.isPaused && !snake.isOver) {
      surface.setState({ ...state, snake: turn(snake, dir) })
    }

    return
  }

  const { typing } = state
  if (typing.endedAt !== 0) {
    if (key === 'return') surface.setState({ ...state, typing: newTyping(typing.text) })
  } else if ([...key].length === 1) {
    const typed = typeKey(typing, key, Date.now())
    if (typed.endedAt !== 0) {
      surface.post({ game: 'typing', score: wordsPerMinute(typed.pos, typed.endedAt - typed.startedAt) })
    }
    surface.setState({ ...state, typing: typed })
  }
}

// ---------- Dessin ----------

const Game: ClientModule<GameProps, State> = (props, surface) => {
  latest = props
  const { Box, Text } = surface.elements
  const state = surface.state
  if (state === undefined) {
    surface.every(TICK_MS, () => onTick(surface))
    surface.onKey(event => onKey(surface, event))
    surface.setState(initialState(props))

    return <Text dimColor>Chargement…</Text>
  }

  const game = currentGame(state, props)
  const { phase } = props
  const now = Date.now()
  const banner = props.isCovered ? (
    <Text color="yellow">! Claude a besoin de toi — partie en pause</Text>
  ) : phase.state === 'working' ? (
    <Text color="cyan">⏳ Claude bosse… {formatDuration(now - phase.since)}</Text>
  ) : phase.state === 'done' ? (
    <Text color="green">✔ Claude a fini en {formatDuration(phase.at - phase.since)} — Échap pour lui répondre</Text>
  ) : (
    <Text dimColor>mode libre</Text>
  )
  const start = <Text bold>▶ Clique ici, puis Espace pour démarrer · Tab : autre jeu</Text>

  if (game === 'snake') {
    const { snake } = state
    const record = Math.max(props.best.snake, snake.isOver ? snake.score : 0)
    const cells = new Map<string, string>()
    snake.body.forEach(([x, y], i) => cells.set(`${x},${y}`, i === 0 ? HEAD : BODY))
    if (snake.food) cells.set(`${snake.food[0]},${snake.food[1]}`, FOOD)

    const rows = []
    for (let y = 0; y < snake.rows; y++) {
      // Une ligne = des segments de même couleur, pour peu d'éléments à dessiner.
      const runs: { color: string | undefined; length: number }[] = []
      for (let x = 0; x < snake.cols; x++) {
        const color = cells.get(`${x},${y}`)
        const last = runs[runs.length - 1]
        if (last && last.color === color) last.length += 1
        else runs.push({ color, length: 1 })
      }
      rows.push(
        <Box flexDirection="row">
          {runs.map(run =>
            run.color === undefined ? (
              <Text>{'  '.repeat(run.length)}</Text>
            ) : (
              <Text color={run.color}>{'██'.repeat(run.length)}</Text>
            ),
          )}
        </Box>,
      )
    }

    const help = !state.isStarted ? start
      : snake.isWon ? <Text bold>🏆 Grille remplie ! Entrée pour rejouer</Text>
      : snake.isOver ? <Text bold>💥 Perdu ! Entrée pour rejouer · Tab : autre jeu</Text>
      : state.isPaused || props.isCovered ? <Text bold>⏸  Pause — Espace pour reprendre</Text>
      : <Text dimColor>←↑↓→ ou ZQSD · Espace : pause · Tab : autre jeu · Échap : sortir</Text>

    return (
      <Box flexDirection="column">
        <Text>🐍 Snake   Score {snake.score}   Record {record}</Text>
        {banner}
        <Box flexDirection="column" borderStyle="round" width={snake.cols * 2 + 2}>
          {rows}
        </Box>
        {help}
      </Box>
    )
  }

  const { typing } = state
  const elapsed = typing.startedAt === 0 ? 0 : (typing.endedAt || now) - typing.startedAt
  const speed = wordsPerMinute(typing.pos, elapsed)
  const accuracy = typing.strokes === 0 ? 100
    : Math.round(((typing.strokes - typing.errors) / typing.strokes) * 100)
  const isDone = typing.endedAt !== 0
  const record = Math.max(props.best.typing, isDone ? speed : 0)
  const lines = wrap(typing.text, Math.max(20, props.columns - 4)).map(([from, to]) => {
    const cursor = Math.min(Math.max(typing.pos, from), to)
    const hasCursor = !isDone && typing.pos >= from && typing.pos < to

    return (
      <Box flexDirection="row">
        <Text color="green">{typing.text.slice(from, cursor)}</Text>
        {hasCursor && (
          <Text inverse color={typing.isWrong ? 'red' : undefined}>{typing.text[cursor]}</Text>
        )}
        <Text dimColor>{typing.text.slice(hasCursor ? cursor + 1 : cursor, to)}</Text>
      </Box>
    )
  })
  const help = !state.isStarted ? start
    : isDone ? <Text bold>{speed >= record && speed > 0 ? '🏆 Record !' : '✔ Terminé.'} Entrée pour la phrase suivante</Text>
    : <Text dimColor>Tape le texte · Tab : autre jeu · Échap : sortir</Text>

  return (
    <Box flexDirection="column">
      <Text>⌨  Frappe   Record {record} mots/min</Text>
      {banner}
      <Box flexDirection="column" paddingY={1}>
        {lines}
      </Box>
      <Text>{speed} mots/min   précision {accuracy} %</Text>
      {help}
    </Box>
  )
}

export default Game
