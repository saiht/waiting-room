'use strict';
const test = require('node:test');
const assert = require('node:assert');

const { newGame, step, turn } = require('../games/snake');
const { wrap, wordsPerMinute } = require('../games/typing');
const { pickDaily, formatDuration } = require('../config');
const { animationLine, ANIMATIONS } = require('../statusline');
const { resolveGame } = require('../play');

test('snake : demi-tour refusé et file de virages limitée à 2', () => {
  const g = newGame(10, 8, () => 0);
  assert.deepStrictEqual(g.food, [0, 0]);
  turn(g, 'left');
  assert.strictEqual(g.queue.length, 0);
  turn(g, 'up'); turn(g, 'left'); turn(g, 'down');
  assert.deepStrictEqual(g.queue, ['up', 'left']);
  step(g);
  assert.deepStrictEqual(g.snake[0], [5, 3]);
  assert.strictEqual(g.snake.length, 3);
});

test('snake : manger fait grandir et marque un point', () => {
  const g = newGame(10, 8, () => 0);
  g.food = [6, 4];
  step(g);
  assert.strictEqual(g.score, 1);
  assert.strictEqual(g.snake.length, 4);
});

test('snake : le mur et le corps sont mortels, suivre sa queue ne l\'est pas', () => {
  let g = newGame(10, 8);
  for (let i = 0; i < 10; i++) step(g);
  assert.ok(g.over);

  g = newGame(10, 8);
  g.food = null;
  g.snake = [[5, 4], [4, 4], [3, 4], [2, 4], [1, 4]];
  for (const d of ['down', 'left', 'up']) { turn(g, d); step(g); }
  assert.ok(g.over);

  g = newGame(10, 8);
  g.food = null;
  g.snake = [[5, 4], [5, 5], [4, 5], [4, 4]];
  g.dir = 'up';
  turn(g, 'left');
  step(g);
  assert.ok(!g.over);
});

test('frappe : découpe sans couper les mots, sans perdre de caractère', () => {
  const text = 'Un bon commit explique pourquoi, pas comment.';
  const ranges = wrap(text, 20);
  assert.strictEqual(ranges.map(([a, b]) => text.slice(a, b)).join(''), text);
  assert.ok(ranges.length > 1);
  for (const [a, b] of ranges.slice(0, -1)) assert.strictEqual(text[b - 1], ' ', text.slice(a, b));
});

test('frappe : mots par minute', () => {
  assert.strictEqual(wordsPerMinute(50, 60000), 10);
  assert.strictEqual(wordsPerMinute(10, 0), 0);
});

test('tirage du jour : stable dans la journée, toujours dans la liste', () => {
  const list = ['a', 'b', 'c'];
  const day = new Date(2026, 10, 17, 9);
  assert.strictEqual(pickDaily(list, 'x', day), pickDaily(list, 'x', new Date(2026, 10, 17, 23)));
  const seen = new Set();
  for (let d = 1; d <= 28; d++) seen.add(pickDaily(list, 'x', new Date(2026, 10, d)));
  assert.deepStrictEqual([...seen].sort(), list);
  assert.strictEqual(pickDaily([], 'x'), undefined);
});

test('choix du jeu : explicite, configuré, tirage, repli', () => {
  const config = { game: 'typing', games: ['snake', 'typing'] };
  assert.strictEqual(resolveGame('snake', config), 0);
  assert.strictEqual(resolveGame(undefined, config), 1);
  assert.strictEqual(resolveGame('inconnu', config), 0);
  assert.strictEqual(resolveGame(undefined, { game: 'random-daily', games: ['typing'] }), 1);
});

test('barre de statut : une ligne par état, largeur constante en animation', () => {
  const config = { statusline: 'runner' };
  const now = 1000000;
  assert.strictEqual(animationLine(config, {}, now), '');
  assert.strictEqual(animationLine({ statusline: 'off' }, { state: 'working', since: 0 }, now), '');
  assert.match(animationLine(config, { state: 'working', since: now - 83000 }, now), /ᕕ\(ᐛ\)ᕗ.*1m23/);
  assert.match(animationLine(config, { state: 'done', since: 1000, at: 6000 }, now), /fini en 5s/);
  assert.match(animationLine(config, { state: 'attention' }, now), /besoin de toi/);
  for (const [name, frame] of Object.entries(ANIMATIONS)) {
    const widths = new Set();
    for (let t = 0; t < 60; t++) widths.add([...frame(t)].length);
    assert.strictEqual(widths.size, 1, name);
  }
});

test('durées', () => {
  assert.strictEqual(formatDuration(9400), '9s');
  assert.strictEqual(formatDuration(83000), '1m23');
});
