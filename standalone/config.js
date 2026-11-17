'use strict';
// Réglages (config.json à côté des scripts), tirage du jour et records.

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = {
  game: 'random-daily',        // "snake" | "typing" | "random-daily" | "off"
  games: ['snake', 'typing'],  // tirage possible en "random-daily"
  delaySeconds: 5,             // attente avant d'ouvrir le panneau de jeu
  statusline: 'random-daily',  // "runner" | "wave" | "serpent" | "random-daily" | "off"
  statuslineBase: '',          // commande d'une barre de statut existante à conserver
};

const DATA_DIR = path.join(os.homedir(), '.waiting-claude');
const STATE_DIR = path.join(os.tmpdir(), 'waiting-claude');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function loadConfig() {
  return { ...DEFAULTS, ...readJson(path.join(__dirname, 'config.json'), {}) };
}

// Même choix toute la journée, sans rien stocker : dérivé de la date.
function pickDaily(list, salt = '', date = new Date()) {
  if (!list.length) return undefined;
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}:${salt}`;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

function stateFile(sessionId) {
  const session = String(sessionId || 'default').replace(/[^\w-]/g, '');
  return path.join(STATE_DIR, `${session}.json`);
}

function getBest(game) {
  return readJson(SCORES_FILE, {})[game] || 0;
}

function setBest(game, value) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SCORES_FILE, JSON.stringify({ ...readJson(SCORES_FILE, {}), [game]: value }));
  } catch {}
}

function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`;
}

module.exports = { loadConfig, pickDaily, stateFile, readJson, getBest, setBest, formatDuration, STATE_DIR };
