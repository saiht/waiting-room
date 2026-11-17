'use strict';
const { getBest, setBest } = require('../config');

// ---------- Logique (pure, testable) ----------

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

function placeFood(g) {
  const taken = new Set(g.snake.map(([x, y]) => `${x},${y}`));
  const free = [];
  for (let y = 0; y < g.rows; y++) {
    for (let x = 0; x < g.cols; x++) {
      if (!taken.has(`${x},${y}`)) free.push([x, y]);
    }
  }
  if (!free.length) return null;
  return free[Math.floor(g.rnd() * free.length)];
}

function newGame(cols, rows, rnd = Math.random) {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const g = {
    cols, rows, rnd,
    snake: [[cx, cy], [cx - 1, cy], [cx - 2, cy]],
    dir: 'right',
    queue: [],
    score: 0,
    over: false,
    won: false,
  };
  g.food = placeFood(g);
  return g;
}

// Met un virage en file d'attente (2 max) pour ne perdre aucune touche entre deux pas.
function turn(g, d) {
  const last = g.queue.length ? g.queue[g.queue.length - 1] : g.dir;
  if (d === last || d === OPPOSITE[last] || g.queue.length >= 2) return;
  g.queue.push(d);
}

function step(g) {
  if (g.over) return;
  if (g.queue.length) g.dir = g.queue.shift();
  const [dx, dy] = DIRS[g.dir];
  const nx = g.snake[0][0] + dx;
  const ny = g.snake[0][1] + dy;
  const eats = g.food && nx === g.food[0] && ny === g.food[1];
  // La queue libère sa case pendant le pas, sauf si le serpent grandit.
  const body = eats ? g.snake : g.snake.slice(0, -1);
  const hitsWall = nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows;
  if (hitsWall || body.some(([x, y]) => x === nx && y === ny)) {
    g.over = true;
    return;
  }
  g.snake.unshift([nx, ny]);
  if (eats) {
    g.score++;
    g.food = placeFood(g);
    if (!g.food) { g.over = true; g.won = true; }
  } else {
    g.snake.pop();
  }
}

function tickDelay(score) {
  return Math.max(55, 130 - score * 3);
}

// ---------- Interface ----------

const KEYS = {
  '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[C': 'right', '\x1b[D': 'left',
  '\x1bOA': 'up', '\x1bOB': 'down', '\x1bOC': 'right', '\x1bOD': 'left',
  z: 'up', w: 'up', s: 'down', q: 'left', a: 'left', d: 'right',
};

function start(sh) {
  let best = getBest('snake');
  let g;
  let started = false; // rien ne bouge avant qu'on appuie sur Espace
  let paused = false;
  let timer = null;

  function reset() {
    const cols = Math.min(28, Math.floor((sh.cols - 2) / 2));
    const rows = Math.min(18, sh.rows - 5);
    g = newGame(Math.max(8, cols), Math.max(6, rows));
    paused = false;
    sh.clear();
    draw();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tick, tickDelay(g.score));
  }

  function tick() {
    if (started && !paused) {
      step(g);
      if (g.over && g.score > best) {
        best = g.score;
        setBest('snake', best);
      }
    }
    draw();
    if (!g.over) schedule();
  }

  function help() {
    if (!started) return ' ▶ Espace pour démarrer · Tab : autre jeu · Échap : quitter';
    if (g.won) return ' 🏆 Grille remplie ! Entrée pour rejouer';
    if (g.over) return ' 💥 Perdu ! Entrée pour rejouer';
    if (paused) return ' ⏸  Pause — Espace pour reprendre';
    return sh.footer('←↑↓→ ou ZQSD · Espace : pause');
  }

  function draw() {
    const cells = new Map();
    g.snake.forEach(([x, y], i) => cells.set(`${x},${y}`, i === 0 ? '\x1b[102m  ' : '\x1b[42m  '));
    if (g.food) cells.set(`${g.food[0]},${g.food[1]}`, '\x1b[101m  ');

    const lines = [
      ` 🐍 Snake   Score \x1b[1m${g.score}\x1b[0m   Record ${best}`,
      sh.statusLine(),
      `┌${'─'.repeat(g.cols * 2)}┐`,
    ];
    for (let y = 0; y < g.rows; y++) {
      let row = '│';
      for (let x = 0; x < g.cols; x++) {
        const c = cells.get(`${x},${y}`);
        row += c ? `${c}\x1b[0m` : '  ';
      }
      lines.push(`${row}│`);
    }
    lines.push(`└${'─'.repeat(g.cols * 2)}┘`, help());
    sh.frame(lines);
  }

  sh.on({
    redraw: draw,
    attention() { if (!g.over) paused = true; },
    key(k) {
      if (!started) {
        if (k === ' ') { started = true; draw(); }
        return;
      }
      if (k === ' ' || k === 'p') {
        if (g.over) return;
        paused = !paused;
        if (!paused) sh.ack();
        return draw();
      }
      if (k === '\r' || k === 'r') {
        if (g.over) reset();
        return;
      }
      const d = KEYS[k] || KEYS[k.toLowerCase()];
      if (d && !paused && !g.over) turn(g, d);
    },
  });

  reset();
  return { stop() { clearTimeout(timer); } };
}

module.exports = { id: 'snake', start, newGame, step, turn };
