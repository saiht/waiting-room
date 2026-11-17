'use strict';
// Socle commun des jeux : écran, clavier, bandeau d'état de Claude, sortie propre.

const fs = require('fs');
const { readJson, formatDuration } = require('./config');

function createShell(stateFile) {
  const pidFile = stateFile ? `${stateFile}.pid` : null;
  let handlers = {};   // { key, attention, redraw } du jeu en cours
  let onSwitch = null;
  let status = null;
  let lastKey = null;  // pour détecter un changement d'état
  let ackKey = null;   // alerte « besoin de toi » déjà vue

  const out = (s) => process.stdout.write(s);

  const sh = {
    get cols() { return process.stdout.columns || 80; },
    get rows() { return process.stdout.rows || 24; },

    // Le jeu en cours déclare ses réactions ; remplacées à chaque changement de jeu.
    on(h) { handlers = h; },
    onSwitch(fn) { onSwitch = fn; },
    ack() { ackKey = lastKey; },
    clear() { out('\x1b[2J'); },

    statusLine() {
      if (!status) return '\x1b[2m mode libre\x1b[0m';
      const { state, since, at } = status;
      if (state === 'done') {
        const took = since && at ? ` en ${formatDuration(at - since)}` : '';
        return `\x1b[30;42m ✔ Claude a fini${took} — Échap pour y retourner \x1b[0m`;
      }
      if (state === 'attention' && ackKey !== lastKey) {
        return '\x1b[30;43m ! Claude a besoin de toi \x1b[0m';
      }
      const elapsed = since ? ` ${formatDuration(Date.now() - since)}` : '';
      return `\x1b[36m ⏳ Claude bosse…${elapsed}\x1b[0m`;
    },

    footer(keys) {
      return `\x1b[2m ${keys} · Tab : autre jeu · Échap : quitter\x1b[0m`;
    },

    frame(lines) {
      out(`\x1b[H${lines.join('\x1b[K\r\n')}\x1b[K\x1b[J`);
    },

    quit() {
      if (pidFile) { try { fs.unlinkSync(pidFile); } catch {} }
      try { process.stdin.setRawMode(false); } catch {}
      out('\x1b[?25h\x1b[?1049l');
      process.exit(0);
    },
  };

  function poll() {
    const s = readJson(stateFile, null);
    if (!s) return;
    if (s.state === 'bye') return sh.quit();
    const key = `${s.state}:${s.token || ''}:${s.at || ''}`;
    status = s;
    if (key !== lastKey) {
      lastKey = key;
      if (s.state !== 'working') out('\x07');
      if (s.state === 'attention' && handlers.attention) handlers.attention();
    }
    if (handlers.redraw) handlers.redraw();
  }

  function onData(chunk) {
    for (const k of chunk.match(/\x1b\[[A-D]|\x1bO[A-D]|[\s\S]/gu) || []) {
      if (k === '\x03' || k === '\x1b') return sh.quit();
      if (k === '\t') { if (onSwitch) onSwitch(); continue; }
      if (handlers.key) handlers.key(k);
    }
  }

  if (pidFile) { try { fs.writeFileSync(pidFile, String(process.pid)); } catch {} }
  out('\x1b[?1049h\x1b[?25l');
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  process.stdin.on('data', onData);
  process.stdout.on('resize', () => { sh.clear(); if (handlers.redraw) handlers.redraw(); });
  process.on('SIGTERM', sh.quit);
  process.on('SIGHUP', sh.quit);
  if (stateFile) { poll(); setInterval(poll, 400); }

  return sh;
}

module.exports = { createShell };
