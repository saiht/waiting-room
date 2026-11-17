'use strict';
const { getBest, setBest } = require('../config');

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
  'Route::get("/articles/{id}", [ArticleController::class, "show"]);',
  'Chez moi, tout fonctionne parfaitement.',
  'Un bon commit explique pourquoi, pas comment.',
  'Les tests passent, donc on ne touche plus à rien.',
  'Il reste deux choses difficiles : nommer et invalider le cache.',
  'Portez ce vieux whisky au juge blond qui fume.',
  'Vendredi, seize heures : surtout pas de mise en production.',
  'Le plus dur dans ce ticket, ce fut de le comprendre.',
  'Dix minutes de lecture évitent deux heures de débogage.',
];

// Découpe en lignes sans couper les mots ; renvoie des intervalles [début, fin[.
function wrap(text, width) {
  const ranges = [];
  let lineStart = 0;
  let lastSpace = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') lastSpace = i;
    if (i - lineStart >= width && lastSpace > lineStart) {
      ranges.push([lineStart, lastSpace + 1]);
      lineStart = lastSpace + 1;
    }
  }
  ranges.push([lineStart, text.length]);
  return ranges;
}

// Mots par minute, sur la base usuelle de 5 caractères par mot.
function wordsPerMinute(chars, ms) {
  return ms > 0 ? Math.round((chars / 5) / (ms / 60000)) : 0;
}

function start(sh) {
  let best = getBest('typing');
  let text = null;
  let started = false; // rien ne se tape avant qu'on appuie sur Espace
  let pos, errors, strokes, startAt, endAt, wrong;

  function next() {
    let pick;
    do { pick = TEXTS[Math.floor(Math.random() * TEXTS.length)]; } while (pick === text);
    text = pick;
    pos = 0; errors = 0; strokes = 0; startAt = null; endAt = null; wrong = false;
    sh.clear();
    draw();
  }

  function draw() {
    const elapsed = startAt ? (endAt || Date.now()) - startAt : 0;
    const wpm = wordsPerMinute(pos, elapsed);
    const accuracy = strokes ? Math.round(((strokes - errors) / strokes) * 100) : 100;

    const lines = [
      ` ⌨  Frappe   Record ${best} mots/min`,
      sh.statusLine(),
      '',
    ];
    for (const [from, to] of wrap(text, Math.max(20, sh.cols - 4))) {
      let line = '  ';
      for (let i = from; i < to; i++) {
        if (i < pos) line += `\x1b[32m${text[i]}\x1b[0m`;
        else if (i === pos) line += `\x1b[${wrong ? '41;97' : '7'}m${text[i]}\x1b[0m`;
        else line += `\x1b[2m${text[i]}\x1b[0m`;
      }
      lines.push(line);
    }
    lines.push('', `  \x1b[1m${wpm}\x1b[0m mots/min   précision ${accuracy} %`, '');
    lines.push(!started
      ? ' ▶ Espace pour démarrer · Tab : autre jeu · Échap : quitter'
      : endAt
      ?` ${wpm >= best && wpm > 0 ? '🏆 Record !' : '✔ Terminé.'} Entrée pour la phrase suivante`
      : sh.footer('Tape le texte'));
    sh.frame(lines);
  }

  sh.on({
    redraw: draw,
    key(k) {
      if (!started) {
        if (k === ' ') { started = true; draw(); }
        return;
      }
      if (endAt) {
        if (k === '\r') next();
        return;
      }
      if (k.length > 2 || k < ' ' || k === '\x7f') return; // flèches, contrôles, retour arrière
      if (!startAt) startAt = Date.now();
      strokes++;
      if (k === text[pos]) {
        pos++;
        wrong = false;
        if (pos === text.length) {
          endAt = Date.now();
          const wpm = wordsPerMinute(pos, endAt - startAt);
          if (wpm > best) { best = wpm; setBest('typing', best); }
        }
      } else {
        errors++;
        wrong = true;
      }
      draw();
    },
  });

  const ticker = setInterval(draw, 500);
  next();
  return { stop() { clearInterval(ticker); } };
}

module.exports = { id: 'typing', start, wrap, wordsPerMinute };
