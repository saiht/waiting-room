#!/usr/bin/env node
'use strict';
// Hook Claude Code : tient à jour un fichier d'état par session (lu par les jeux et la
// barre de statut) et ouvre le jeu dans un panneau voisin quand Claude travaille depuis
// plus de quelques secondes.
//
// Événements gérés : UserPromptSubmit, Stop, Notification, SessionEnd.
// Ne rien écrire sur stdout : pour UserPromptSubmit, ce serait injecté dans le contexte.

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { loadConfig, stateFile, readJson, STATE_DIR } = require('./config');

function writeState(file, state) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file); // atomique : personne ne lit un fichier à moitié écrit
}

function gameAlive(file) {
  try {
    process.kill(parseInt(fs.readFileSync(`${file}.pid`, 'utf8'), 10), 0);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

function openPane(file) {
  const cmd = [process.execPath, path.join(__dirname, 'play.js'), '--state', file]
    .map(shellQuote).join(' ');
  if (process.env.TMUX) {
    spawnSync('tmux', ['split-window', '-h', '-l', '45%', cmd]);
  } else if (process.env.TERM_PROGRAM === 'iTerm.app') {
    const sessionId = (process.env.ITERM_SESSION_ID || '').split(':').pop();
    spawnSync('osascript', [path.join(__dirname, 'iterm-split.applescript'), sessionId, cmd]);
  }
  // Autre terminal : rien d'automatique, lancer `node play.js` à la main.
}

// Mode différé : `hook.js --launch <fichier> <token>`, lancé en arrière-plan par UserPromptSubmit.
function launchLater(file, token) {
  setTimeout(() => {
    const s = readJson(file, {});
    if (s.state === 'working' && s.token === token && !gameAlive(file)) openPane(file);
  }, loadConfig().delaySeconds * 1000);
}

function handle(input) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const file = stateFile(input.session_id);
  const prev = readJson(file, {});
  const now = Date.now();

  switch (input.hook_event_name) {
    case 'UserPromptSubmit': {
      const token = `${now}-${Math.random().toString(36).slice(2)}`;
      writeState(file, { state: 'working', since: now, token });
      if (loadConfig().game !== 'off' && !gameAlive(file)) {
        spawn(process.execPath, [__filename, '--launch', file, token], {
          detached: true,
          stdio: 'ignore',
        }).unref();
      }
      break;
    }
    case 'Stop':
      writeState(file, { ...prev, state: 'done', at: now });
      break;
    case 'Notification':
      if (prev.state === 'working') writeState(file, { ...prev, state: 'attention', at: now });
      break;
    case 'SessionEnd':
      writeState(file, { state: 'bye', at: now });
      break;
  }
}

if (process.argv[2] === '--launch') {
  launchLater(process.argv[3], process.argv[4]);
} else {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    try { handle(JSON.parse(raw || '{}')); } catch {}
  });
}
