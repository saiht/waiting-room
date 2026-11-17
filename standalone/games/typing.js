'use strict';
const { getBest, setBest } = require('../config');

const TEXTS = [
  'Chez moi, tout fonctionne parfaitement.',
  'Un bon commit explique pourquoi, pas comment.',
  'Les tests passent, donc on ne touche plus à rien.',
  'Il reste deux choses difficiles : nommer et invalider le cache.',
  'Portez ce vieux whisky au juge blond qui fume.',
  'Vendredi, seize heures : surtout pas de mise en production.',
  'Le plus dur dans ce ticket, ce fut de le comprendre.',
  'Dix minutes de lecture évitent deux heures de débogage.',
  'Ce bug est en fait une fonctionnalité bien cachée.',
  'Tout marchait très bien avant la dernière mise à jour.',
  'Un café, un casque, et le code avance tout seul.',
  'On verra ça plus tard, disait le vieux commentaire.',
  'Rien ne presse, sauf quand tout presse en même temps.',
  'Qui relit son code le lendemain apprend la modestie.',
  'La réunion aurait très bien pu être un simple message.',
  'Sauvegarde souvent, tu te remercieras un jour.',
  'Mieux vaut un petit pas livré qu\'un grand plan parfait.',
  'Encore une petite tâche, et après je vais dormir.',
  'Pendant que Claude travaille, mes doigts se dégourdissent.',
  'Nommer une variable prend parfois plus de temps que le reste.',
  'Le chat a encore marché sur le clavier ce matin.',
  'Faire simple demande souvent beaucoup de travail.',
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
    lines.push(!startAt
      ? ' ▶ Tape le premier caractère pour démarrer · Tab : autre jeu · Échap : quitter'
      : endAt
      ?` ${wpm >= best && wpm > 0 ? '🏆 Record !' : '✔ Terminé.'} Entrée pour la phrase suivante`
      : sh.footer('Tape le texte'));
    sh.frame(lines);
  }

  sh.on({
    redraw: draw,
    key(k) {
      if (endAt) {
        if (k === '\r') next();
        return;
      }
      if (k.length > 2 || k < ' ' || k === '\x7f') return; // flèches, contrôles, retour arrière
      // Le chrono part au premier caractère juste ; avant, rien ne compte.
      if (!startAt && k !== text[0]) return;
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
