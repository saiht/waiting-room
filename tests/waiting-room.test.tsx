import { expect, mock, test } from 'claude-code/testing'

import { newSnake, step, turn, typeKey, newTyping, wordsPerMinute, wrap } from '../hooks/game'
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
