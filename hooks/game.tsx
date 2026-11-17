// Module de surface : les mini-jeux, dessinés et joués dans le panneau.
// Il n'a pas accès à `$` : les scores partent vers le module de hooks avec `surface.post`.
import type { ClientKeyEvent, ClientModule, ClientSurface } from 'claude-code'

import type { GameId, GameProps, PetStage } from '../types'

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
  /** Dernier effet joué autour du tamagotchi, et le battement où il a commencé. */
  fx: { kind: '' | 'hearts' | 'crumbs' | 'win' | 'lose' | 'clean'; at: number }
  /** La devinette : dans quelle main est le cookie ? */
  guess: { stage: 'idle' | 'pick' | 'reveal'; side: number; at: number }
  snake: Snake
  typing: Typing
  runner: Runner
  racer: Racer
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
  'git switch -c feature/nouvelle-idee',
  'git diff --stat main...HEAD',
  'git cherry-pick -x 0a60037',
  'git push --force-with-lease origin HEAD',
  'curl -s https://example.com/api | jq ".items[0]"',
  'find . -name "*.log" -mtime +7 -delete',
  'tail -f storage/logs/laravel.log',
  'chmod +x deploy.sh && ./deploy.sh --dry-run',
  'docker ps --format "{{.Names}}: {{.Status}}"',
  'npx tsc --noEmit && npm run lint',
  'kill -9 $(lsof -ti :3000)',
  'alias gs="git status --short"',
  'const [first, ...rest] = await Promise.all(tasks);',
  'const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
  'return items.filter(Boolean).map((item) => item.id);',
  'try { await save(); } catch (error) { console.error(error); }',
  'type Result<T> = { ok: true; value: T } | { ok: false };',
  'UPDATE users SET active = true WHERE id = 42;',
  'SELECT status, COUNT(*) FROM orders GROUP BY status;',
  '$users = User::where("active", true)->orderBy("name")->get();',
  "Ce n'est pas un bug, c'est une fonctionnalité non documentée.",
  'Ça marchait hier, et personne ne sait pourquoi.',
  'Le code le plus rapide est celui que personne ne lance.',
  "Avant d'optimiser, mesure ; avant de mesurer, respire.",
  'Un commentaire qui ment est pire que pas de commentaire.',
  'Supprimer du code reste la meilleure façon de le corriger.',
  'La documentation existe, elle est juste dans la tête de quelqu\'un.',
  "Redémarrer règle la moitié des pannes et cache l'autre moitié.",
  'Une réunion de moins, une fonctionnalité de plus.',
  'Le lundi, on relit ; le vendredi, on ne déploie pas.',
  'Qui ne tente rien ne risque pas de casser la production.',
  'Mieux vaut tard que jamais, sauf pour les sauvegardes.',
  "L'habit ne fait pas le moine, mais le nom fait la variable.",
  'Buvez de ce whisky que le patron juge fameux.',
  "Joyeux, ivre, fatigué, le nez qui pique, Clown Hary skie dans l'ombre.",
  'Zut ! Je crois que le chien Sambuca préfère le whisky revigorant au doux porto.',
  "Petit à petit, l'oiseau fait son nid.",
  'Tout vient à point à qui sait attendre.',
  "Pierre qui roule n'amasse pas mousse.",
  'Rien ne sert de courir, il faut partir à point.',
  'Après la pluie vient le beau temps.',
  'Les petits ruisseaux font les grandes rivières.',
  "C'est en forgeant qu'on devient forgeron.",
  "Chat échaudé craint l'eau froide.",
  'Faites fondre le beurre, puis ajoutez la farine en pluie.',
  'Une pincée de sel, trois tomates et beaucoup de patience.',
  'La pâte à crêpes doit reposer une heure, le cuisinier aussi.',
  'Un bon café le matin vaut mieux que deux réunions.',
  'Le fromage se sert avant le dessert, jamais à la place.',
  'Ne jamais faire confiance à une baguette encore tiède : elle disparaît.',
  'La lumière du Soleil met environ huit minutes à nous parvenir.',
  'La tour Eiffel grandit de quelques centimètres en été.',
  'Les chats dorment une bonne quinzaine d\'heures par jour, les veinards.',
  'Le train de sept heures douze partira avec vingt minutes de retard.',
  "En montagne, le sommet paraît toujours plus proche qu'il ne l'est.",
  'La mer monte, les mouettes crient, le sandwich est en danger.',
  'Sous la pluie bretonne, même les parapluies abandonnent.',
  'Longtemps, je me suis couché de bonne heure.',
  'La raison du plus fort est toujours la meilleure.',
  "Je pense, donc je suis ; je tape, donc j'attends.",
  'Rien ne se perd, rien ne se crée, tout se transforme.',
  'Il faut cultiver notre jardin.',
  'Va, cours, vole, et nous venge.',
  'Le hasard ne favorise que les esprits préparés.',
  'La vie est trop courte pour taper avec deux doigts.',
  "Les chaussettes de l'archiduchesse sont-elles sèches, archisèches ?",
  'Un chasseur sachant chasser doit savoir chasser sans son chien.',
  'Si six scies scient six cyprès, six cents scies scient six cents cyprès.',
  'Trois tortues trottaient sur un trottoir très étroit.',
  "Je veux et j'exige d'exquises excuses.",
  "Didon dîna, dit-on, du dos d'un dodu dindon.",
  'Cinq chiens chassent six chats.',
  'Pendant que Claude réfléchit, mes doigts font de la gymnastique.',
  'Encore une phrase, et promis, je retourne travailler.',
  'Le serpent a faim, le tamagotchi aussi, et moi donc.',
  'Patience : la réponse arrive, la frappe progresse.',
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

// ---------- Course ----------

export type Obstacle = { x: number; w: number; h: number }

export type Runner = {
  width: number
  /** Hauteur des pieds au-dessus du sol, en lignes. */
  y: number
  vy: number
  obstacles: readonly Obstacle[]
  distance: number
  /** Distance restante avant le prochain obstacle. */
  toNext: number
  isOver: boolean
}

/** Colonne du coureur (son dessin fait 3 colonnes, on ne heurte que celle du milieu). */
const RUNNER_X = 5
const SCENE_ROWS = 4
const JUMP = 1
const GRAVITY = 0.25

export const runnerScore = (runner: Runner) => Math.floor(runner.distance / 4)
/** Cases parcourues par pas : la course accélère avec le score. */
const runnerSpeed = (runner: Runner) => Math.min(1.8, 1 + runnerScore(runner) / 300)

export function newRunner(columns: number): Runner {
  const width = Math.max(28, Math.min(60, columns - 4))

  return { width, y: 0, vy: 0, obstacles: [], distance: 0, toNext: 20, isOver: false }
}

/** Saute, s'il a les pieds au sol. */
export function jump(runner: Runner): Runner {
  return runner.isOver || runner.y > 0 ? runner : { ...runner, vy: JUMP }
}

export function stepRunner(runner: Runner, random: () => number = Math.random): Runner {
  if (runner.isOver) return runner
  const speed = runnerSpeed(runner)
  let { y, vy } = runner
  if (y > 0 || vy > 0) {
    y += vy
    vy -= GRAVITY
    if (y <= 0) { y = 0; vy = 0 }
  }
  // Un obstacle touche s'il a croisé la colonne du coureur pendant ce pas, pieds trop bas.
  const column = RUNNER_X + 1
  const isHit = runner.obstacles.some(one =>
    one.x - speed < column + 1 && one.x + one.w > column && y < one.h - 0.3)
  const obstacles = runner.obstacles
    .map(one => ({ ...one, x: one.x - speed }))
    .filter(one => one.x + one.w > 0)
  let toNext = runner.toNext - speed
  if (toNext <= 0) {
    const isTall = random() < 0.3
    obstacles.push({ x: runner.width, h: isTall ? 2 : 1, w: !isTall && random() < 0.4 ? 2 : 1 })
    toNext = (10 + random() * 14) * speed // toujours plus long qu'un saut
  }

  return { ...runner, y, vy, obstacles, toNext, distance: runner.distance + speed, isOver: isHit }
}

type Segment = { text: string; color: string | undefined }

/** Les lignes de la scène, du ciel au sol, découpées en segments d'une même couleur. */
export function runnerRows(runner: Runner, beat: number): Segment[][] {
  const feet = Math.floor(runner.y)
  const legs = runner.isOver ? '_ _' : runner.y > 0 ? '\\ /' : beat % 2 === 0 ? '/ \\' : '| |'
  const head = runner.isOver ? '(x)' : '(•)'
  const rows: Segment[][] = []
  for (let level = SCENE_ROWS - 1; level >= 0; level--) {
    const cells: { char: string; color: string | undefined }[] = []
    for (let i = 0; i < runner.width; i++) {
      const isStar = level === 3 ? (i + Math.floor(runner.distance / 3)) % 19 === 7
        : level === 2 && (i * 3 + Math.floor(runner.distance / 2)) % 23 === 0
      cells.push({ char: isStar ? '·' : ' ', color: undefined })
    }
    for (const one of runner.obstacles) {
      if (level >= one.h) continue
      for (let i = Math.floor(one.x); i < Math.floor(one.x) + one.w; i++) {
        if (i >= 0 && i < runner.width) cells[i] = { char: '█', color: '#e5484d' }
      }
    }
    const sprite = level === feet ? legs : level === feet + 1 ? head : ''
    for (let i = 0; i < sprite.length; i++) {
      const char = sprite[i]
      if (char !== undefined && char !== ' ') cells[RUNNER_X + i] = { char, color: '#b6f36a' }
    }
    const row: Segment[] = []
    for (const cell of cells) {
      const last = row[row.length - 1]
      if (last && last.color === cell.color) last.text += cell.char
      else row.push({ text: cell.char, color: cell.color })
    }
    rows.push(row)
  }

  return rows
}

// ---------- Course auto, vue du cockpit ----------

export type RaceCar = { z: number; x: number; color: string }

export type Racer = {
  width: number
  /** Position sur la route : -1 bord gauche, 1 bord droit ; au-delà, c'est l'herbe. */
  x: number
  speed: number
  distance: number
  /** Courbure de la route sous les roues, et celle vers laquelle elle tend. */
  curve: number
  target: number
  nextTurnAt: number
  /** Cap cumulé : fait défiler les montagnes dans les virages. */
  heading: number
  /** Les autres voitures, à une distance z devant (1 : à notre hauteur). */
  cars: readonly RaceCar[]
  toNext: number
  /** Pas pendant lesquels le capot penche encore, signé par le sens du coup de volant. */
  lean: number
  isOver: boolean
}

const ROAD_ROWS = 8
const SKY_ROWS = 3
const LANES = [-0.62, 0, 0.62]
const CAR_COLORS = ['#f5d90a', '#e879f9', '#ff8b3e']
const CURVES = [-0.8, -0.45, 0, 0, 0.45, 0.8]
const RIDGE = '▁▁▂▃▂▁▁▁▂▄▅▄▂▁▁▂▃▂▁▁▁▁▂▃▄▃▂▁'

const mod = (value: number, by: number) => ((value % by) + by) % by
const bound = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export const racerScore = (racer: Racer) => Math.floor(racer.distance / 3)
const racerTopSpeed = (racer: Racer) => Math.min(1.4, 0.7 + racerScore(racer) / 400)

export function newRacer(columns: number): Racer {
  return {
    width: bound(columns - 4, 28, 60),
    x: 0, speed: 0.3, distance: 0,
    curve: 0, target: 0, nextTurnAt: 25, heading: 0,
    cars: [], toNext: 18, lean: 0, isOver: false,
  }
}

/** Un coup de volant : -1 à gauche, 1 à droite. */
export function steer(racer: Racer, dir: -1 | 1): Racer {
  return racer.isOver ? racer : { ...racer, x: bound(racer.x + dir * 0.14, -1.5, 1.5), lean: dir * 4 }
}

export function stepRacer(racer: Racer, random: () => number = Math.random): Racer {
  if (racer.isOver) return racer
  // Dans l'herbe on ralentit ; sur la route la voiture accélère toute seule.
  const speed = Math.abs(racer.x) > 1
    ? Math.max(0.25, racer.speed * 0.9)
    : Math.min(racerTopSpeed(racer), racer.speed + 0.012)
  const distance = racer.distance + speed
  let { target, nextTurnAt } = racer
  if (distance >= nextTurnAt) {
    target = CURVES[Math.floor(random() * CURVES.length)] ?? 0
    nextTurnAt = distance + 30 + random() * 40
  }
  const curve = racer.curve + bound(target - racer.curve, -0.03, 0.03)
  // Le virage déporte vers l'extérieur : il faut tourner dans son sens pour rester en piste.
  const x = bound(racer.x - curve * speed * 0.045, -1.5, 1.5)
  const closing = Math.max(0, speed - 0.35) * 0.25
  const moved = racer.cars.map(car => ({ ...car, z: car.z - closing }))
  const isHit = moved.some(car => car.z <= 1.1 && car.z > 0.75 && Math.abs(car.x - x) < 0.42)
  const cars = moved.filter(car => car.z > 0.75)
  let toNext = racer.toNext - speed
  if (toNext <= 0) {
    cars.push({
      z: 8.5,
      x: LANES[Math.floor(random() * LANES.length)] ?? 0,
      color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)] ?? '#f5d90a',
    })
    toNext = 9 + random() * 12
  }

  return {
    ...racer, x, speed, distance, curve, target, nextTurnAt, cars, toNext,
    heading: racer.heading + curve * speed * 0.6,
    lean: racer.lean === 0 ? 0 : racer.lean - Math.sign(racer.lean),
    isOver: isHit,
  }
}

type Tile = { char: string; color: string | undefined }

function toSegments(cells: readonly Tile[]): Segment[] {
  const row: Segment[] = []
  for (const cell of cells) {
    const last = row[row.length - 1]
    if (last && last.color === cell.color) last.text += cell.char
    else row.push({ text: cell.char, color: cell.color })
  }

  return row
}

/** La scène vue du cockpit : ciel, montagnes, route en perspective, voitures, capot. */
export function racerRows(racer: Racer): Segment[][] {
  const width = racer.width
  const rows: Tile[][] = []
  const put = (row: number, from: number, text: string, color: string) => {
    const cells = rows[row]
    if (!cells) return
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const at = from + i
      if (char !== undefined && char !== ' ' && at >= 0 && at < width) cells[at] = { char, color }
    }
  }

  for (let sky = 0; sky < SKY_ROWS; sky++) {
    const cells: Tile[] = []
    for (let i = 0; i < width; i++) {
      if (sky === SKY_ROWS - 1) {
        cells.push({ char: RIDGE[mod(i + Math.round(racer.heading * 2), RIDGE.length)] ?? '▁', color: '#5b7a99' })
      } else {
        const isStar = sky === 0 && mod(i * 7 + Math.round(racer.heading), 23) === 3
        cells.push({ char: isStar ? '·' : ' ', color: undefined })
      }
    }
    rows.push(cells)
  }

  // La route : chaque ligne plus bas est plus proche, donc plus large.
  const shape: { center: number; half: number }[] = []
  for (let i = 0; i < ROAD_ROWS; i++) {
    const near = (i + 1) / ROAD_ROWS
    const half = near * width * 0.42
    const center = width / 2 + racer.curve * (1 - near) * (1 - near) * width * 0.55 - racer.x * half * 0.9
    const band = mod(Math.floor(racer.distance * 0.8 + (1 / near) * 1.6), 2)
    const edge = Math.max(1, near * 2.2)
    const cells: Tile[] = []
    for (let i2 = 0; i2 < width; i2++) {
      const off = Math.abs(i2 + 0.5 - center)
      if (off > half) cells.push({ char: band ? '▒' : '░', color: '#2f7d3b' })
      else if (off > half - edge) cells.push({ char: '█', color: band ? '#e5484d' : '#e8e8e8' })
      else if (band === 0 && off <= 0.5) cells.push({ char: '┊', color: '#e8e8e8' })
      else if (band === 0 && Math.abs(off - half * 0.36) < 0.5) cells.push({ char: '·', color: '#9a9a9a' })
      else cells.push({ char: ' ', color: undefined })
    }
    rows.push(cells)
    shape.push({ center, half })
  }

  // Les voitures, de la plus lointaine à la plus proche.
  for (const car of [...racer.cars].sort((a, b) => b.z - a.z)) {
    const near = Math.min(1, 1 / car.z)
    const i = bound(Math.round(near * ROAD_ROWS) - 1, 0, ROAD_ROWS - 1)
    const at = shape[i]
    if (!at) continue
    const size = Math.max(1, Math.round(near * 8))
    const body = size === 1 ? '▪' : size === 2 ? '▟▙' : `▟${'█'.repeat(size - 2)}▙`
    const left = Math.floor(at.center + car.x * at.half * 0.9 - size / 2)
    if (size >= 4) put(SKY_ROWS + i - 1, left + 1, '▄'.repeat(size - 2), car.color)
    put(SKY_ROWS + i, left, body, car.color)
  }

  const hood = Math.max(10, Math.round(width * 0.4))
  const wing = Math.floor((hood - 5) / 2)
  rows.push(Array.from({ length: width }, (): Tile => ({ char: ' ', color: undefined })))
  put(
    SKY_ROWS + ROAD_ROWS,
    Math.floor((width - hood) / 2) + Math.sign(racer.lean),
    `▟${'▀'.repeat(wing)}(┼)${'▀'.repeat(hood - 5 - wing)}▙`,
    racer.isOver ? '#e5484d' : '#7dd3fc',
  )

  return rows.map(toSegments)
}

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

function currentGame(state: State, props: GameProps): GameId {
  const game = state.override !== null && state.overrideFor === props.game ? state.override : props.game

  return game === 'pet' && props.pet === null ? 'snake' : game
}

/** Tab : snake, frappe, course, puis le tamagotchi s'il est activé. */
function nextGame(game: GameId, props: GameProps): GameId {
  const order: GameId[] = props.pet === null
    ? ['snake', 'typing', 'runner', 'racer']
    : ['snake', 'typing', 'runner', 'racer', 'pet']

  return order[(order.indexOf(game) + 1) % order.length] ?? 'snake'
}

/** Jauge de 5 crans pour une valeur de 0 à 100. */
const gauge = (value: number) => {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 20)

  return '▰'.repeat(filled) + '▱'.repeat(5 - filled)
}

function initialState(props: GameProps): State {
  return {
    override: null,
    overrideFor: props.game,
    isStarted: false,
    isPaused: false,
    fx: { kind: '', at: 0 },
    guess: { stage: 'idle', side: 0, at: 0 },
    snake: newSnake(props.columns),
    typing: newTyping(),
    runner: newRunner(props.columns),
    racer: newRacer(props.columns),
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
  } else if (
    currentGame(state, latest) === 'runner' &&
    state.isStarted && !state.isPaused && !latest.isCovered && !state.runner.isOver
  ) {
    if (ticks % 2 !== 0) return
    const runner = stepRunner(state.runner)
    if (runner.isOver) surface.post({ game: 'runner', score: runnerScore(runner) })
    surface.setState({ ...state, runner })
  } else if (
    currentGame(state, latest) === 'racer' &&
    state.isStarted && !state.isPaused && !latest.isCovered && !state.racer.isOver
  ) {
    if (ticks % 2 !== 0) return
    const racer = stepRacer(state.racer)
    if (racer.isOver) surface.post({ game: 'racer', score: racerScore(racer) })
    surface.setState({ ...state, racer })
  } else if (ticks % (currentGame(state, latest) === 'pet' ? 6 : 12) === 0) {
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
      override: nextGame(game, latest),
      overrideFor: latest.game,
      isStarted: false,
      isPaused: false,
      snake: newSnake(latest.columns),
      typing: newTyping(state.typing.text),
      runner: newRunner(latest.columns),
      racer: newRacer(latest.columns),
    })

    return
  }
  if (game === 'pet') {
    const pressed = key.toLowerCase()
    const fx = (kind: State['fx']['kind']) => ({ kind, at: ticks })
    if (state.guess.stage === 'pick' && (pressed === 'left' || pressed === 'right')) {
      const hasWon = (pressed === 'left' ? 0 : 1) === state.guess.side
      surface.post({ pet: 'play', won: hasWon })
      surface.setState({ ...state, guess: { ...state.guess, stage: 'reveal', at: ticks }, fx: fx(hasWon ? 'win' : 'lose') })
    } else if (pressed === ' ' || pressed === 'c') {
      surface.post({ pet: 'stroke' })
      surface.setState({ ...state, fx: fx('hearts') })
    } else if (pressed === 'f') {
      surface.post({ pet: 'treat' })
      const canEat = latest.pet !== null && latest.pet.cookies > 0 && latest.pet.stage !== 'egg'
      surface.setState({ ...state, fx: canEat ? fx('crumbs') : state.fx })
    } else if (pressed === 'j' && latest.pet !== null && latest.pet.stage !== 'egg') {
      surface.setState({ ...state, guess: { stage: 'pick', side: Math.random() < 0.5 ? 0 : 1, at: ticks } })
    } else if (pressed === 'j') {
      surface.post({ pet: 'play', won: false })
    } else if (pressed === 'n') {
      surface.post({ pet: 'clean' })
      surface.setState({ ...state, fx: latest.pet !== null && latest.pet.bugs > 0 ? fx('clean') : state.fx })
    }

    return
  }
  if (!state.isStarted) {
    if (key === ' ') surface.setState({ ...state, isStarted: true })

    return
  }

  if (game === 'racer') {
    const { racer } = state
    const pressed = key.toLowerCase()
    if (pressed === 'p') {
      if (!racer.isOver) surface.setState({ ...state, isPaused: !state.isPaused })
    } else if (pressed === 'return' || pressed === 'r') {
      if (racer.isOver) surface.setState({ ...state, isPaused: false, racer: newRacer(latest.columns) })
    } else if (!state.isPaused && (pressed === 'left' || pressed === 'q' || pressed === 'a')) {
      surface.setState({ ...state, racer: steer(racer, -1) })
    } else if (!state.isPaused && (pressed === 'right' || pressed === 'd')) {
      surface.setState({ ...state, racer: steer(racer, 1) })
    }

    return
  }

  if (game === 'runner') {
    const { runner } = state
    const pressed = key.toLowerCase()
    if (pressed === 'p') {
      if (!runner.isOver) surface.setState({ ...state, isPaused: !state.isPaused })
    } else if (pressed === 'return' || pressed === 'r') {
      if (runner.isOver) surface.setState({ ...state, isPaused: false, runner: newRunner(latest.columns) })
    } else if ((pressed === ' ' || pressed === 'up' || pressed === 'z' || pressed === 'w') && !state.isPaused) {
      surface.setState({ ...state, runner: jump(runner) })
    }

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

// Le tamagotchi à chaque âge ; FFF est remplacé par ses yeux et sa bouche.
const ART: Record<PetStage, readonly string[]> = {
  egg: [
    '    ___',
    '   /   \\',
    '  |  ·  |',
    '   \\___/',
  ],
  baby: [
    '  .-----.',
    ' (  FFF  )',
    "  `-----'",
    '   U   U',
  ],
  teen: [
    '  /\\___/\\',
    ' (  FFF  )',
    '  >  ^  <',
    '  (__|__)',
  ],
  adult: [
    '   \\  |  /',
    '  .-------.',
    ' (   FFF   )',
    '  \\  ___  /',
    '  /|     |\\',
    '   d     b',
  ],
  sage: [
    '      ✦',
    '   .-/\\-.',
    '  (  FFF  )',
    ' ~/|  ~  |\\~',
    "   `-..-'",
  ],
}

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
  const start = <Text bold>▶ Espace pour démarrer · Tab : autre jeu (clique ici si rien ne répond)</Text>

  if (game === 'pet' && props.pet !== null) {
    const pet = props.pet
    const beat = Math.floor(ticks / 12) // deux battements par seconde environ
    const fx = ticks - state.fx.at < 45 ? state.fx.kind : ''
    const isPicking = state.guess.stage === 'pick'
    const isRevealing = state.guess.stage === 'reveal' && ticks - state.guess.at < 45
    const isBlinking = ticks % 100 < 5 && pet.mood !== 'sulking'
    const art = ART[pet.stage].map(line => line.replace('FFF', isBlinking ? '-‿-' : pet.expression))
    const isLively = pet.mood === 'happy' || pet.mood === 'loved' || pet.mood === 'eating' || fx === 'win'
    const isUp = isLively && beat % 2 === 0 // il sautille : la ligne vide passe du dessus au dessous
    const sway = pet.stage === 'egg' || pet.mood === 'hungry' ? beat % 2 : 0 // l'œuf oscille, l'affamé tremble
    const tint = pet.mood === 'sulking' ? 'red'
      : pet.mood === 'hungry' || pet.mood === 'sad' ? 'yellow'
      : pet.mood === 'loved' ? 'magenta' : 'cyan'
    const above = fx === 'hearts' || pet.mood === 'loved' ? (beat % 2 === 0 ? '♥       ♥' : '    ♥')
      : fx === 'crumbs' ? ' · crunch ·'
      : fx === 'win' ? ' ✦   ✦   ✦'
      : fx === 'lose' ? ' ~ hi hi ~'
      : fx === 'clean' ? ' ✧ propre ✧'
      : pet.mood === 'sulking' ? '    💢'
      : pet.mood === 'hungry' ? '    …' : ''
    const hands = isPicking ? '✊           ✊'
      : isRevealing ? (state.guess.side === 0 ? '🍪           ✋' : '✋           🍪') : ''
    const width = Math.min(Math.max(32, props.columns), 46)
    const base = Math.max(0, Math.floor((width - 4 - 13) / 2))
    // Le retrait passe par la mise en page, pas par des espaces en tête de texte.
    const row = (text: string, shift: number, color?: string) => (
      <Box paddingLeft={base + shift + text.length - text.trimStart().length}>
        <Text color={color} bold={color !== undefined}>{text.trimStart() || ' '}</Text>
      </Box>
    )
    const body = art.map(line => row(line, sway, tint))
    const stage = pet.nextXp === null ? `${pet.xp} xp` : `${pet.xp} / ${pet.nextXp} xp`

    return (
      <Box flexDirection="column">
        <Text>🐣 {pet.name}   {pet.stageLabel} · {pet.ageDays} j · {pet.meals} repas · {stage}</Text>
        {banner}
        <Box flexDirection="column" borderStyle="round" width={width}>
          {row(above, 0, 'magenta')}
          {isUp ? body : row('', 0)}
          {isUp ? row('', 0) : body}
          {row(hands, 0)}
          <Box flexDirection="row" justifyContent="space-between" paddingX={1}>
            <Box paddingLeft={pet.bugs > 0 ? beat % 8 : 0}>
              <Text>{'🐛 '.repeat(pet.bugs) || ' '}</Text>
            </Box>
            <Text>🍪 × {pet.cookies}</Text>
          </Box>
        </Box>
        <Text italic>« {isPicking ? 'Dans quelle main est le cookie ? ← →' : pet.words} »</Text>
        <Box flexDirection="row" gap={3}>
          <Text>faim <Text color={pet.satiety < 25 ? 'red' : 'green'}>{gauge(pet.satiety)}</Text> {pet.satiety} %</Text>
          <Text>humeur <Text color={pet.happiness < 30 ? 'red' : 'green'}>{gauge(pet.happiness)}</Text> {pet.happiness} %</Text>
        </Box>
        <Text bold>[Espace] caresser  [F] friandise  [J] jouer  [N] nettoyer</Text>
        <Text dimColor>Tab : autre jeu · Échap : sortir</Text>
      </Box>
    )
  }

  if (game === 'racer') {
    const { racer } = state
    const score = racerScore(racer)
    const record = Math.max(props.best.racer, racer.isOver ? score : 0)
    const isOffRoad = Math.abs(racer.x) > 1
    const help = !state.isStarted ? start
      : racer.isOver ? <Text bold>💥 Accrochage ! Entrée pour repartir · Tab : autre jeu</Text>
      : state.isPaused || props.isCovered ? <Text bold>⏸  Pause — P pour reprendre</Text>
      : isOffRoad ? <Text bold color="yellow">Dans l'herbe ! Reviens sur la route</Text>
      : <Text dimColor>← → ou Q D : tourner · P : pause · Tab : autre jeu · Échap : sortir</Text>

    return (
      <Box flexDirection="column">
        <Text>🏎  Bolide   Score {score}   Record {record}   {Math.round(racer.speed * 140)} km/h</Text>
        {banner}
        <Text>╭{'─'.repeat(racer.width)}╮</Text>
        {racerRows(racer).map(row => (
          <Text>
            │{row.map(one => (one.color === undefined ? one.text : <Text color={one.color}>{one.text}</Text>))}│
          </Text>
        ))}
        <Text>╰{'─'.repeat(racer.width)}╯</Text>
        {help}
      </Box>
    )
  }

  if (game === 'runner') {
    const { runner } = state
    const score = runnerScore(runner)
    const record = Math.max(props.best.runner, runner.isOver ? score : 0)
    const post = (i: number) => ((i + Math.floor(runner.distance)) % 8 === 0 ? '┴' : '─')
    const ground = Array.from({ length: runner.width }, (_, i) => post(i)).join('')
    const help = !state.isStarted ? start
      : runner.isOver ? <Text bold>💥 Aïe ! Entrée pour repartir · Tab : autre jeu</Text>
      : state.isPaused || props.isCovered ? <Text bold>⏸  Pause — P pour reprendre</Text>
      : <Text dimColor>Espace ou ↑ : sauter · P : pause · Tab : autre jeu · Échap : sortir</Text>

    return (
      <Box flexDirection="column">
        <Text>🏃 Course   Score {score}   Record {record}</Text>
        {banner}
        <Text>╭{'─'.repeat(runner.width)}╮</Text>
        {runnerRows(runner, Math.floor(ticks / 4)).map(row => (
          <Text>
            │{row.map(one => (one.color === undefined ? one.text : <Text color={one.color}>{one.text}</Text>))}│
          </Text>
        ))}
        <Text>╰{ground}╯</Text>
        {help}
      </Box>
    )
  }

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
