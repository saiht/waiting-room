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
