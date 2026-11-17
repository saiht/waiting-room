import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Best, GameId, GameProps, Pet, Phase } from '../types'
import { SULK_AFTER_MS, age, clean, feed, newPet, play, restorePet, stageOf, statusOf, stroke, sulk, treat, viewOf } from './pet'

const PANE = 'waiting-room'
/** Les jeux du tirage du jour ; le tamagotchi s'ouvre à la demande ou avec Tab. */
const DAILY_GAMES: readonly GameId[] = ['snake', 'typing']
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
// bornAt à 0 : pas encore chargé depuis le stockage.
const petAtom = atom({ plugin: 'waiting-room', key: 'pet' } as const, newPet(0), { shape: 'pet-2' })

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

const isGame = (value: unknown): value is GameId =>
  value === 'snake' || value === 'typing' || value === 'pet'

// Ce que les minuteurs lisent sans attendre : repart de zéro à chaque rechargement,
// puis `session.start` le remplit.
const live = {
  pet: undefined as Pet | undefined,
  petName: 'Mochi',
  isPetOn: true,
  /** Outils utilisés pendant le tour en cours. */
  tools: 0,
  /** Depuis quand une boîte de dialogue de Claude attend une réponse (0 : aucune). */
  askedAt: 0,
  /** Plus longue attente du tour, pas encore prise en compte. */
  longestWait: 0,
  /** Boîtes de dialogue déjà vues, pour ne pas les recompter quand elles se redessinent. */
  asked: new Set<string>(),
  hasHinted: false,
}

async function openPane($: EngineInterface, isAsked: boolean): Promise<void> {
  // Le clavier est demandé pour le panneau ; Claude Code ne l'accorde que si le prompt est vide.
  const opened = await $.ui.open({ id: PANE, title: 'En attendant Claude', focus: true, rows: 19, columns: 56 })
  if (!opened.isPlaced && !isAsked && !live.hasHinted) {
    live.hasHinted = true
    $.ui.toast('🎮 Tape /waiting pour jouer en attendant Claude')
  }
}

async function savePet($: EngineInterface, pet: Pet): Promise<void> {
  live.pet = pet
  await update($, petAtom, () => pet)
  await $.store.set('pet', pet)
}

/** La boîte de dialogue a eu sa réponse : on retient combien de temps elle a attendu. */
function markAnswered(now: number): void {
  if (live.askedAt === 0) return
  live.longestWait = Math.max(live.longestWait, now - live.askedAt)
  live.askedAt = 0
}

/** Si Claude a attendu trop longtemps une réponse, le tamagotchi boude. */
async function settleWait($: EngineInterface): Promise<void> {
  const now = await $.clock.now()
  markAnswered(now)
  const waited = live.longestWait
  live.longestWait = 0
  if (live.isPetOn && live.pet && waited > SULK_AFTER_MS) {
    const sulky = sulk(live.pet, now, waited)
    await savePet($, sulky)
    $.ui.toast(`${viewOf(sulky, live.petName, now).face} ${live.petName} boude. ${sulky.words}`)
  }
}

export const register: Register = (on, options) => {
  const gameOption = String(options.game ?? 'random-daily')
  const animationOption = String(options.animation ?? 'random-daily')
  const delayMs = Math.max(0, Number(options.delaySeconds ?? 5) || 0) * 1000
  const closeWhenDone = options.closeWhenDone === true
  live.isPetOn = options.pet !== false
  live.petName = String(options.petName ?? '').trim().slice(0, 20) || 'Mochi'

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
      description: 'Ouvre un mini-jeu ou le tamagotchi pour patienter pendant que Claude travaille',
      argumentHint: '[snake|typing|pet|close]',
      immediate: true,
    })
    const stored = (await $.store.get('best')) as Partial<Best> | undefined
    if (stored) {
      const kept: Best = { snake: Number(stored.snake) || 0, typing: Number(stored.typing) || 0 }
      await update($, best, () => kept)
    }
    if (live.isPetOn) {
      const now = await $.clock.now()
      const pet = age(restorePet(await $.store.get('pet'), now), now)
      await savePet($, pet)
      $.ui.status(statusOf(viewOf(pet, live.petName, now)))
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, phase, (): Phase => ({ state: 'working', since: now, at: 0 }))
      stopTimers()
      live.tools = 0
      live.askedAt = 0
      live.longestWait = 0

      const name = ANIMATIONS[animationOption]
        ? animationOption
        : pickDaily(Object.keys(ANIMATIONS), 'animation', now)
      const frame = animationOption === 'off' || name === undefined ? undefined : ANIMATIONS[name]
      if (frame || live.isPetOn) {
        let t = 0
        ticker = $.clock.every(500, () => {
          t += 1
          const elapsed = t * 500
          const at = now + elapsed
          const isImpatient = live.askedAt !== 0 && at - live.askedAt > SULK_AFTER_MS
          const face = live.isPetOn && live.pet
            ? `${viewOf(live.pet, live.petName, at, isImpatient ? 'sulking' : undefined).face} `
            : ''
          const middle = isImpatient ? 'Claude t\'attend… ' : frame ? `${frame(t)} ` : ''
          $.ui.status(`${face}${middle}${formatDuration(elapsed)}`)
        })
      }
      if (gameOption !== 'off') {
        opener = $.clock.after(delayMs, () => void openPane($, false))
      }
    }

    return next(e)
  })

  // Chaque outil passe par ici avant de tourner : on les compte, et l'outil
  // précédent, s'il attendait une réponse, l'a forcément eue.
  on('tool.check', async ($, e, next) => {
    live.tools += 1
    await settleWait($)

    return next(e)
  }).catch(($, e, next) => next(e)) // un souci ici ne doit jamais toucher aux permissions

  // Une boîte de dialogue (permission, question) s'affiche : Claude attend.
  // Un hook de dessin ne peut rien écrire : il note seulement l'heure.
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    if (!live.asked.has(e.requestId)) {
      if (live.asked.size > 500) live.asked.clear()
      live.asked.add(e.requestId)
      if (live.askedAt === 0) live.askedAt = await $.clock.now()
    }

    return next(e)
  })

  // L'outil avance : la réponse a donc été donnée.
  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if (live.askedAt !== 0) markAnswered(await $.clock.now())

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await settleWait($)
      stopTimers()
      const now = await $.clock.now()
      await update($, phase, (held): Phase => ({ state: 'done', since: held.since, at: now }))

      if (live.isPetOn && live.pet) {
        const before = stageOf(live.pet.xp).stage
        const fed = feed(live.pet, now, live.tools)
        await savePet($, fed)
        const view = viewOf(fed, live.petName, now)
        if (view.stage !== before) $.ui.toast(`${view.face} ${live.petName} : ${fed.words}`)
        $.ui.status(`${view.face} ${live.petName} · ${fed.words}`)
        clearer = $.clock.after(15000, () => {
          if (live.pet) $.ui.status(statusOf(viewOf(live.pet, live.petName, now + 15000)))
        })
      } else if (animationOption !== 'off') {
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
      return { text: `Jeu inconnu : ${arg}. Choix possibles : snake, typing, pet, close.` }
    }
    if (arg === 'pet' && !live.isPetOn) {
      return { text: 'Le tamagotchi est désactivé : réactive-le dans /config.' }
    }
    if (isGame(arg)) await update($, chosen, () => arg)
    await openPane($, true)

    return { text: 'Panneau ouvert : clique dedans pour jouer, Échap pour rendre le clavier à Claude.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)

      return <Text dimColor>Les mini-jeux se jouent dans le terminal ou l'app desktop.</Text>
    }
    const { Client } = $.ui.resolve(e)
    const now = await $.clock.now()
    const picked = await read($, chosen)
    const pet = await read($, petAtom)
    const hasPet = live.isPetOn && pet.bornAt !== 0
    const daily = pickDaily(DAILY_GAMES, 'game', now) ?? 'snake'
    const wanted = isGame(picked) ? picked : isGame(gameOption) ? gameOption : daily
    const props: GameProps = {
      game: wanted === 'pet' && !hasPet ? daily : wanted,
      phase: await read($, phase),
      best: await read($, best),
      pet: hasPet ? viewOf(pet, live.petName, now) : null,
      isCovered: e.props.isPromptCovered === true,
      columns: e.props.bodyColumns,
    }

    return <Client key="game" module="./game.tsx" props={props} />
  })

  // Le panneau parle au module : un score à garder, ou une caresse.
  on('ui.message', async ($, e, next) => {
    const data = e.data as { game?: unknown; score?: unknown; pet?: unknown; won?: unknown } | null
    if (e.requestId !== PANE || !data) return next(e)

    if ((data.game === 'snake' || data.game === 'typing') && typeof data.score === 'number') {
      const score = Math.round(data.score)
      const held = await read($, best)
      if (Number.isFinite(score) && score > held[data.game] && score < 100000) {
        const record: Best = { ...held, [data.game]: score }
        await update($, best, () => record)
        await $.store.set('best', record)
      }
    }
    if (typeof data.pet === 'string' && live.isPetOn && live.pet) {
      const now = await $.clock.now()
      const acted = data.pet === 'stroke' ? stroke(live.pet, now)
        : data.pet === 'treat' ? treat(live.pet, now)
        : data.pet === 'play' ? play(live.pet, now, data.won === true)
        : data.pet === 'clean' ? clean(live.pet, now)
        : undefined
      if (acted) {
        await savePet($, acted)
        if ((await read($, phase)).state !== 'working') {
          $.ui.status(statusOf(viewOf(acted, live.petName, now)))
        }
      }
    }

    return next(e)
  })
}
