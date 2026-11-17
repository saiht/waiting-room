import { expect, mock, test } from 'claude-code/testing'

import { jump, newRacer, newRunner, newSnake, newTyping, racerRows, runnerRows, runnerScore, steer, step, stepRacer, stepRunner, turn, typeKey, wordsPerMinute, wrap } from '../hooks/game'
import { age, clean, feed, gauge, moodOf, newPet, play, restorePet, stageOf, stroke, sulk, treat, viewOf } from '../hooks/pet'
import { formatDuration, pickDaily } from '../hooks/register'

const PANE = {
  plugin: 'waiting-room',
  component: 'Pane',
  requestId: 'waiting-room',
  props: {
    title: 'En attendant Claude',
    isFocused: false,
    bodyColumns: 56,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const shown = async (ui: { find: (q: object) => Promise<unknown> }, text: RegExp) =>
  (await ui.find({ type: 'Text', text, in: 'game' })) !== undefined

test('snake : rien ne bouge avant Espace, puis la partie se joue', { options: { game: 'snake' } }, async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await shown(ui, /Snake/)).toBe(true)
  expect(await shown(ui, /Espace pour démarrer/)).toBe(true)
  await ui.advance(5000)
  expect(await shown(ui, /Perdu/)).toBe(false)

  await ui.key({ key: ' ' })
  expect(await shown(ui, /Espace : pause/)).toBe(true)
  await ui.advance(5000) // tout droit jusqu'au mur
  expect(await shown(ui, /Perdu/)).toBe(true)

  await ui.key({ key: 'return' })
  expect(await shown(ui, /Espace : pause/)).toBe(true)
  await ui.unmount()
})

test('Tab passe au test de frappe, qui attend Espace lui aussi', { options: { game: 'snake' } }, async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.key({ key: 'tab' })
  expect(await shown(ui, /Frappe/)).toBe(true)
  expect(await shown(ui, /Espace pour démarrer/)).toBe(true)
  await ui.key({ key: ' ' })
  expect(await shown(ui, /Tape le texte/)).toBe(true)
  await ui.unmount()
})

test('une boîte de dialogue de Claude met le snake en pause', { options: { game: 'snake' } }, async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.key({ key: ' ' })
  await ui.redraw({ ...PANE.props, isPromptCovered: true })
  expect(await shown(ui, /Claude a besoin de toi/)).toBe(true)
  await ui.advance(5000)
  expect(await shown(ui, /Perdu/)).toBe(false)
  await ui.unmount()
})

test('un score annoncé par le jeu devient le record, et seulement s\'il le bat', { options: { game: 'snake' } }, async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.post({ game: 'snake', score: 7 })
  await ui.post({ game: 'snake', score: 3 })
  await ui.post({ game: 'inconnu', score: 99 })
  await ui.redraw()
  expect(await shown(ui, /Record 7/)).toBe(true)
  await ui.unmount()
})

test('le panneau ne s\'ouvre qu\'après le délai réglé, et la barre de statut s\'anime', { options: { delaySeconds: 30, game: 'snake', animation: 'runner' } }, async ($, on) => {
  const clock = mock.clock(on)
  const opened: string[] = []
  const statuses: (string | undefined)[] = []
  on('ui.open', (_, e) => {
    opened.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.status', (_, e) => {
    statuses.push(e.text)

    return { value: undefined }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))

  await $.turn.start({ text: 'salut', turnId: 't1' })
  await clock.advance(29000)
  expect(opened).toEqual([])
  await clock.advance(2000)
  expect(opened).toEqual(['waiting-room'])
  expect(statuses.some(s => (s ?? '').includes('ᕕ(ᐛ)ᕗ'))).toBe(true)
})

test('hors terminal et desktop, le panneau explique où jouer', async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  expect(await ui.find({ type: 'Text', text: /terminal/ })).toBeDefined()
  await ui.unmount()
})

test('logique du snake', () => {
  const first = () => 0
  let snake = newSnake(56, first)
  expect(snake.food).toEqual([0, 0])
  expect(turn(snake, 'left')).toBe(snake) // demi-tour refusé
  snake = turn(turn(turn(snake, 'up'), 'left'), 'down')
  expect(snake.queue).toEqual(['up', 'left']) // file limitée à 2
  const head = snake.body[0]
  snake = step(snake, first)
  expect(snake.body[0]).toEqual([head![0], head![1] - 1])
  expect(snake.body.length).toBe(3)

  const fed = step({ ...newSnake(56, first), food: [13, 5] }, first)
  expect(fed.score).toBe(1)
  expect(fed.body.length).toBe(4)

  let straight = newSnake(56, first)
  for (let i = 0; i < 30; i++) straight = step(straight, first)
  expect(straight.isOver).toBe(true)
})

test('logique du test de frappe', () => {
  let typing = { ...newTyping('', () => 0), text: 'ab' }
  typing = typeKey(typing, 'x', 1000)
  expect([typing.pos, typing.errors, typing.isWrong]).toEqual([0, 1, true])
  typing = typeKey(typing, 'a', 2000)
  typing = typeKey(typing, 'b', 7000)
  expect([typing.pos, typing.strokes, typing.startedAt, typing.endedAt]).toEqual([2, 3, 1000, 7000])
  expect(wordsPerMinute(50, 60000)).toBe(10)

  const text = 'Un bon commit explique pourquoi, pas comment.'
  const ranges = wrap(text, 20)
  expect(ranges.map(([a, b]) => text.slice(a, b)).join('')).toBe(text)
  expect(ranges.length > 1).toBe(true)
})

test('tirage du jour et durées', () => {
  const list = ['a', 'b', 'c']
  const morning = new Date(2026, 10, 17, 9).getTime()
  const evening = new Date(2026, 10, 17, 23).getTime()
  expect(pickDaily(list, 'x', morning)).toBe(pickDaily(list, 'x', evening))
  const seen = new Set<string | undefined>()
  for (let d = 1; d <= 28; d++) seen.add(pickDaily(list, 'x', new Date(2026, 10, d).getTime()))
  expect([...seen].sort()).toEqual(list)
  expect(formatDuration(83000)).toBe('1m23')
})

test('tamagotchi : repas, faim, bouderie, caresse', () => {
  const t0 = 1_000_000
  const egg = newPet(t0)
  expect(stageOf(egg.xp).stage).toBe('egg')

  const pet = feed(egg, t0, 5)
  expect(stageOf(pet.xp).stage).toBe('baby')
  expect([pet.words, pet.meals]).toEqual(['Il a éclos !', 1])
  expect(moodOf(pet, t0 + 1000)).toBe('eating')
  expect(viewOf(pet, 'Mochi', t0 + 20000).face).toBe('(•ᴗ•)')

  const later = t0 + 20 * 3_600_000
  const hungry = age(pet, later)
  expect(hungry.satiety).toBe(0)
  expect(moodOf(hungry, later)).toBe('hungry')

  const sulky = sulk(pet, t0 + 60000, 95000)
  expect(moodOf(sulky, t0 + 70000)).toBe('sulking')
  expect(sulky.words).toBe('Hmpf. Claude t\'a attendu 1 min.')
  expect(sulky.happiness).toBe(pet.happiness - 15)

  const forgiven = stroke(sulky, t0 + 80000)
  expect([forgiven.sulkUntil, forgiven.words]).toEqual([0, 'Bon… pardonné.'])
  expect(moodOf(forgiven, t0 + 81000)).toBe('loved')
  expect(stroke(forgiven, t0 + 81000).happiness).toBe(forgiven.happiness) // trop tôt pour compter
  expect(feed(sulky, t0 + 90000, 0).sulkUntil).toBe(0) // un repas, et c'est oublié

  expect(restorePet({ ...pet }, later)).toEqual(pet)
  expect(restorePet({ ...pet, xp: 'beaucoup' }, later).xp).toBe(0)
  // une bestiole née avant les cookies garde tout le reste
  const { cookies: _, ...older } = pet
  expect(restorePet(older, later)).toEqual({ ...pet, cookies: 1 })
  expect(restorePet(undefined, later).bornAt).toBe(later)
  expect(gauge(60)).toBe('▰▰▰▱▱')
})

test('une tâche terminée nourrit le tamagotchi ; faire attendre Claude le fait bouder', { options: { game: 'off', animation: 'off' } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const statuses: string[] = []
  const toasts: string[] = []
  on('ui.status', (_, e) => {
    statuses.push(e.text ?? '')

    return { value: undefined }
  })
  on('ui.toast', (_, e) => {
    toasts.push(e.text)

    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'waiting' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: 'fait' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(statuses.at(-1)).toContain('Mochi')

  await $.turn.start({ text: 'salut', turnId: 't1' })
  const dialog = await $.ui.mount({ plugin: 'waiting-room', component: 'AskUserQuestion', requestId: 'outil-1', surface: 'terminal', props: { tool: 'Bash', questions: [] } })
  await clock.advance(45000)
  expect(statuses.some(s => s.includes('Claude t\'attend'))).toBe(true)

  await dialog.unmount()
  await $.turn.complete({ answer: 'fait', durationMs: 45000, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(toasts.some(t => t.includes('Mochi boude'))).toBe(true)
  expect(statuses.at(-1)).toContain('L\'œuf a bougé')
})

test('le tamagotchi se caresse dans le panneau, et se désactive', { options: { game: 'pet' } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('ui.status', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'waiting' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await shown(ui, /Mochi/)).toBe(true)
  expect(await shown(ui, /Un œuf/)).toBe(true)
  await ui.key({ key: ' ' })
  await ui.redraw()
  expect(await shown(ui, /tout chaud/)).toBe(true)
  await ui.key({ key: 'tab' })
  expect(await shown(ui, /Snake/)).toBe(true)
  await ui.unmount()
})

test('tamagotchi désactivé : pas de vue dans le panneau, ni dans le cycle de Tab', { options: { game: 'pet', pet: false } }, async ($, on) => {
  mock.clock(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await shown(ui, /Mochi/)).toBe(false)
  await ui.key({ key: 'tab' })
  await ui.key({ key: 'tab' })
  expect(await shown(ui, /Mochi/)).toBe(false)
  await ui.unmount()
})

test('tamagotchi : friandise, devinette, bugs à nettoyer', () => {
  const t0 = 1_000_000
  const egg = newPet(t0)
  expect(treat(egg, t0).cookies).toBe(1) // un œuf ne mange pas
  expect(play(egg, t0, true).xp).toBe(0)

  let pet = feed(egg, t0, 5) // éclos, un cookie de plus
  expect(pet.cookies).toBe(2)
  const snacked = treat(pet, t0 + 1000)
  expect([snacked.cookies, snacked.words]).toEqual([1, 'Crunch crunch !'])
  expect(snacked.satiety > pet.satiety).toBe(true)
  expect(treat({ ...pet, cookies: 0 }, t0).words).toContain('Plus de cookies')

  const won = play(pet, t0 + 120000, true)
  expect([won.xp, won.words]).toEqual([pet.xp + 1, 'Gagné ! Encore !'])
  const again = play(won, t0 + 121000, false)
  expect(again.xp).toBe(won.xp) // pas d'expérience deux fois dans la minute
  expect(again.happiness > won.happiness).toBe(true)

  for (let i = 0; i < 3; i++) pet = feed(pet, t0, 0) // quatrième repas : un bug
  expect([pet.meals, pet.bugs]).toEqual([4, 1])
  expect(pet.words).toContain('bug')
  const day = age(pet, t0 + 10 * 3_600_000)
  expect(day.happiness < pet.happiness).toBe(true) // les bugs qui traînent l'attristent
  const tidy = clean(pet, t0)
  expect([tidy.bugs, tidy.words]).toEqual([0, 'Bug corrigé. Tout propre !'])
  expect(clean(tidy, t0).words).toBe('Rien à nettoyer.')
})

test('dans le panneau : friandise, devinette et nettoyage', { options: { game: 'pet' } }, async ($, on) => {
  const t0 = 1_000_000
  mock.clock(on, { now: t0 })
  mock.store(on, { pet: { ...feed(newPet(t0), t0, 5), bugs: 2, lastMealAt: 1 } })
  on('ui.status', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'waiting' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await shown(ui, /\(  .{3}  \)/)).toBe(true) // le bébé, dessiné en grand
  expect(await shown(ui, /🍪 × 2/)).toBe(true)

  await ui.key({ key: 'f' })
  await ui.redraw()
  expect(await shown(ui, /Crunch/)).toBe(true)
  expect(await shown(ui, /🍪 × 1/)).toBe(true)

  await ui.key({ key: 'n' })
  await ui.redraw()
  expect(await shown(ui, /2 bugs corrigés/)).toBe(true)

  await ui.key({ key: 'j' })
  expect(await shown(ui, /Dans quelle main/)).toBe(true)
  await ui.key({ key: 'left' })
  await ui.redraw()
  expect(await shown(ui, /Gagné|Raté/)).toBe(true)
  await ui.unmount()
})

test('logique de la course', () => {
  const never = () => 0.9
  let runner = newRunner(60)
  expect(runner.width).toBe(56)

  // un saut : il monte, redescend, et ne peut pas ressauter en l'air
  runner = jump(runner)
  const heights: number[] = []
  for (let i = 0; i < 9; i++) {
    runner = stepRunner(runner, never)
    heights.push(runner.y)
    if (i === 3) expect(jump(runner)).toBe(runner)
  }
  expect(heights).toEqual([1, 1.75, 2.25, 2.5, 2.5, 2.25, 1.75, 1, 0])
  expect(runnerScore(runner)).toBe(2)

  // un obstacle sur sa route : heurté au sol, franchi en l'air
  const ahead = { ...newRunner(60), obstacles: [{ x: 7, w: 1, h: 1 }] }
  expect(stepRunner(ahead, never).isOver).toBe(true)
  expect(stepRunner({ ...ahead, y: 1.75, vy: 0.25 }, never).isOver).toBe(false)
  // un obstacle haut demande d'être au sommet du saut
  const tall = { ...newRunner(60), obstacles: [{ x: 7, w: 1, h: 2 }] }
  expect(stepRunner({ ...tall, y: 0.5, vy: 0.5 }, never).isOver).toBe(true)
  expect(stepRunner({ ...tall, y: 1.75, vy: 0.5 }, never).isOver).toBe(false)

  // les obstacles arrivent par la droite, et la scène montre le coureur
  let long = newRunner(60)
  for (let i = 0; i < 21; i++) long = stepRunner(long, never)
  expect(long.obstacles.length).toBe(1)
  const drawn = (r: typeof long) => runnerRows(r, 0).map(row => row.map(one => one.text).join('')).join('\n')
  expect(drawn(long)).toContain('(•)')
  expect(drawn(long)).toContain('█')
  expect(drawn({ ...long, isOver: true })).toContain('(x)')
  expect(runnerRows(long, 0).every(row => row.map(one => one.text).join('').length === 56)).toBe(true)
})

test('course : Espace démarre puis fait sauter ; sans sauter, on finit dans un obstacle', { options: { game: 'runner' } }, async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await shown(ui, /Course/)).toBe(true)
  expect(await shown(ui, /Espace pour démarrer/)).toBe(true)
  await ui.advance(10000)
  expect(await shown(ui, /Aïe/)).toBe(false)

  await ui.key({ key: ' ' })
  expect(await shown(ui, /sauter/)).toBe(true)
  await ui.advance(15000)
  expect(await shown(ui, /Aïe/)).toBe(true)
  await ui.key({ key: 'return' })
  expect(await shown(ui, /sauter/)).toBe(true)
  await ui.unmount()
})

test('logique de la course auto', () => {
  const never = () => 0.5
  const racer = newRacer(60)
  expect(racer.width).toBe(56)

  // le volant, borné, et sans effet une fois accidenté
  expect(steer(racer, 1).x).toBe(0.14)
  expect(steer({ ...racer, x: 1.45 }, 1).x).toBe(1.5)
  expect(steer({ ...racer, isOver: true }, 1).x).toBe(0)

  // elle accélère sur la route, ralentit dans l'herbe
  expect(stepRacer(racer, never).speed > racer.speed).toBe(true)
  expect(stepRacer({ ...racer, x: 1.3, speed: 1 }, never).speed).toBe(0.9)

  // un virage à droite déporte vers la gauche
  expect(stepRacer({ ...racer, curve: 0.8, target: 0.8, speed: 1 }, never).x < 0).toBe(true)

  // une voiture à notre hauteur : accident sur la même file, dépassement sur une autre
  const close = { ...racer, speed: 1, cars: [{ z: 1.1, x: 0, color: 'red' }] }
  expect(stepRacer(close, never).isOver).toBe(true)
  const passing = stepRacer({ ...close, x: 0.62 }, never)
  expect(passing.isOver).toBe(false)
  let gone = passing
  for (let i = 0; i < 6; i++) gone = stepRacer(gone, never)
  expect(gone.cars.length).toBe(0)

  // une nouvelle voiture apparaît au loin
  expect(stepRacer({ ...racer, toNext: 0.1 }, never).cars[0]?.z).toBe(8.5)

  // la scène : 12 lignes de la bonne largeur, avec le capot et son volant
  const rows = racerRows({ ...close, curve: 0.5 }).map(row => row.map(one => one.text).join(''))
  expect(rows.length).toBe(12)
  expect(rows.every(row => row.length === 56)).toBe(true)
  expect(rows.at(-1)).toContain('(┼)')
})

test('course auto : Espace démarre, le volant mène dans l\'herbe si on insiste', { options: { game: 'racer' } }, async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await shown(ui, /Bolide/)).toBe(true)
  expect(await shown(ui, /Espace pour démarrer/)).toBe(true)
  await ui.key({ key: ' ' })
  expect(await shown(ui, /tourner/)).toBe(true)
  for (let i = 0; i < 9; i++) await ui.key({ key: 'left' })
  expect(await shown(ui, /Dans l'herbe/)).toBe(true)
  await ui.key({ key: 'p' })
  expect(await shown(ui, /Pause/)).toBe(true)
  await ui.unmount()
})
