import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Best, GameId, GameProps, Phase } from '../types'

const PANE = 'waiting-room'
const GAMES: readonly GameId[] = ['snake', 'typing']
const TRACK = 16

const phase = atom(
  { plugin: 'waiting-room', key: 'phase' } as const,
  { state: 'idle', since: 0, at: 0 } as Phase,
  { shape: 'phase-1' },
)
const chosen = atom({ plugin: 'waiting-room', key: 'game' } as const, '')
const best = atom(
  { plugin: 'waiting-room', key: 'best' } as const,
  { snake: 0, typing: 0 } as Best,
  { shape: 'best-1' },
)

const ANIMATIONS: Record<string, (t: number) => string> = {
  runner(t) {
    const p = t % TRACK

    return `${'·'.repeat(p)}ᕕ(ᐛ)ᕗ${'·'.repeat(TRACK - 1 - p)}`
  },
  wave(t) {
    const bars = '▁▂▃▄▅▆▇█▇▆▅▄▃▂'
    let line = ''
    for (let i = 0; i < TRACK; i++) line += bars[(i + t) % bars.length]

    return line
  },
  serpent(t) {
    const body = '∿∿∿∿ö'
    const lane = TRACK + body.length
    const p = t % lane

    return (' '.repeat(p) + body + ' '.repeat(lane)).slice(body.length, lane)
  },
}

// Même choix toute la journée, sans rien stocker : dérivé de la date.
export function pickDaily<T>(list: readonly T[], salt: string, now: number): T | undefined {
  const date = new Date(now)
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}:${salt}`
  let hash = 0
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) >>> 0

  return list[hash % list.length]
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))

  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`
}

const isGame = (value: unknown): value is GameId => value === 'snake' || value === 'typing'

let hasHinted = false

async function openPane($: EngineInterface, isAsked: boolean): Promise<void> {
  const opened = await $.ui.open({ id: PANE, title: 'En attendant Claude', rows: 17, columns: 56 })
  if (!opened.isPlaced && !isAsked && !hasHinted) {
    hasHinted = true
    $.ui.toast('🎮 Tape /waiting pour jouer en attendant Claude')
  }
}

export const register: Register = (on, options) => {
  const gameOption = String(options.game ?? 'random-daily')
  const animationOption = String(options.animation ?? 'random-daily')
  const delayMs = Math.max(0, Number(options.delaySeconds ?? 5) || 0) * 1000
  const closeWhenDone = options.closeWhenDone === true

  let ticker: Timer | undefined
  let opener: Timer | undefined
  let clearer: Timer | undefined

  const stopTimers = () => {
    ticker?.cancel()
    opener?.cancel()
    clearer?.cancel()
    ticker = opener = clearer = undefined
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'waiting',
      description: 'Ouvre un mini-jeu pour patienter pendant que Claude travaille',
      argumentHint: '[snake|typing|close]',
      immediate: true,
    })
    const stored = (await $.store.get('best')) as Partial<Best> | undefined
    if (stored) {
      const kept: Best = { snake: Number(stored.snake) || 0, typing: Number(stored.typing) || 0 }
      await update($, best, () => kept)
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, phase, (): Phase => ({ state: 'working', since: now, at: 0 }))
      stopTimers()

      const name = ANIMATIONS[animationOption]
        ? animationOption
        : pickDaily(Object.keys(ANIMATIONS), 'animation', now)
      const frame = name === undefined ? undefined : ANIMATIONS[name]
      if (animationOption !== 'off' && frame) {
        let t = 0
        ticker = $.clock.every(500, () => {
          t += 1
          $.ui.status(`${frame(t)} ${formatDuration(t * 500)}`)
        })
      }
      if (gameOption !== 'off') {
        opener = $.clock.after(delayMs, () => void openPane($, false))
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      stopTimers()
      const now = await $.clock.now()
      await update($, phase, (held): Phase => ({ state: 'done', since: held.since, at: now }))
      if (animationOption !== 'off') {
        $.ui.status(`(ᴗ˳ᴗ) zZ  fini en ${formatDuration(e.durationMs)}`)
        clearer = $.clock.after(15000, () => $.ui.status(undefined))
      }
      if (closeWhenDone) await $.ui.close({ id: PANE })
    }

    return next(e)
  })

  on('command.run', { command: 'waiting' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'close' || arg === 'off') {
      await $.ui.close({ id: PANE })

      return { text: 'Panneau de jeu fermé.' }
    }
    if (arg !== '' && !isGame(arg)) {
      return { text: `Jeu inconnu : ${arg}. Choix possibles : snake, typing, close.` }
    }
    if (isGame(arg)) await update($, chosen, () => arg)
    await openPane($, true)

    return { text: 'Jeu ouvert : clique dedans pour jouer, Échap pour rendre le clavier à Claude.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)

      return <Text dimColor>Les mini-jeux se jouent dans le terminal ou l'app desktop.</Text>
    }
    const { Client } = $.ui.resolve(e)
    const picked = await read($, chosen)
    const daily = pickDaily(GAMES, 'game', await $.clock.now()) ?? 'snake'
    const props: GameProps = {
      game: isGame(picked) ? picked : isGame(gameOption) ? gameOption : daily,
      phase: await read($, phase),
      best: await read($, best),
      isCovered: e.props.isPromptCovered === true,
      columns: e.props.bodyColumns,
    }

    return <Client key="game" module="./game.tsx" props={props} />
  })

  // Le jeu annonce un score : on garde le record, dans la session et au-delà.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown } | null
    if (e.requestId === PANE && data && isGame(data.game) && typeof data.score === 'number') {
      const score = Math.round(data.score)
      const held = await read($, best)
      if (Number.isFinite(score) && score > held[data.game] && score < 100000) {
        const record: Best = { ...held, [data.game]: score }
        await update($, best, () => record)
        await $.store.set('best', record)
      }
    }

    return next(e)
  })
}
