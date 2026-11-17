#!/usr/bin/env node
'use strict';
// Barre de statut Claude Code : une petite animation pendant que Claude travaille.
// Si config.statuslineBase est renseigné, sa sortie est conservée au-dessus.

const fs = require('fs');
const { spawnSync } = require('child_process');
const { loadConfig, pickDaily, stateFile, readJson, formatDuration } = require('./config');

const TRACK = 16;
const BASE_CACHE_MS = 4000; // la barre d'origine est relancée moins souvent que l'animation

const ANIMATIONS = {
  runner(t) {
    const p = t % TRACK;
    return `${'·'.repeat(p)}ᕕ(ᐛ)ᕗ${'·'.repeat(TRACK - 1 - p)}`;
  },
  wave(t) {
    const bars = '▁▂▃▄▅▆▇█▇▆▅▄▃▂';
    let s = '';
    for (let i = 0; i < TRACK; i++) s += bars[(i + t) % bars.length];
    return s;
  },
  serpent(t) {
    const body = '∿∿∿∿ö';
    const lane = TRACK + body.length;
    const p = t % lane;
    return (' '.repeat(p) + body + ' '.repeat(lane)).slice(body.length, lane);
  },
};

function animationLine(config, state, now = Date.now()) {
  if (config.statusline === 'off' || !state.state || state.state === 'bye') return '';
  const names = Object.keys(ANIMATIONS);
  const name = ANIMATIONS[config.statusline] ? config.statusline : pickDaily(names, 'statusline');
  if (state.state === 'attention') return '\x1b[33m(°ロ°)! Claude a besoin de toi\x1b[0m';
  if (state.state === 'done') {
    const took = state.since && state.at ? ` en ${formatDuration(state.at - state.since)}` : '';
    return `\x1b[2m(ᴗ˳ᴗ) zZ  fini${took}\x1b[0m`;
  }
  const frame = ANIMATIONS[name](Math.floor(now / 500));
  return `\x1b[36m${frame}\x1b[0m \x1b[2m${formatDuration(now - state.since)}\x1b[0m`;
}

function baseLine(command, raw, file) {
  if (!command) return '';
  const cacheFile = `${file}.base`;
  const cached = readJson(cacheFile, null);
  if (cached && Date.now() - cached.at < BASE_CACHE_MS) return cached.out;
  const res = spawnSync(command, { shell: true, input: raw, encoding: 'utf8', timeout: 8000 });
  const out = (res.stdout || '').replace(/\n+$/, '');
  try { fs.writeFileSync(cacheFile, JSON.stringify({ at: Date.now(), out })); } catch {}
  return out;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw || '{}'); } catch {}
    const config = loadConfig();
    const file = stateFile(input.session_id);
    const lines = [
      baseLine(config.statuslineBase, raw, file),
      animationLine(config, readJson(file, {})),
    ].filter(Boolean);
    process.stdout.write(lines.join('\n'));
  });
}

if (require.main === module) main();

module.exports = { animationLine, ANIMATIONS };
