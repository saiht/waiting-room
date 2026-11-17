#!/usr/bin/env node
'use strict';
// Lance un jeu : `node play.js [snake|typing] [--state <fichier-d-état>]`
// Sans nom de jeu, suit config.json (jeu fixe ou tirage du jour). Tab passe au jeu suivant.

const { loadConfig, pickDaily } = require('./config');
const { createShell } = require('./shell');

const GAMES = [require('./games/snake'), require('./games/typing')];

function resolveGame(requested, config) {
  let id = requested || config.game;
  if (id === 'random-daily' || id === 'off') {
    id = pickDaily(config.games.filter((g) => GAMES.some((x) => x.id === g)), 'game');
  }
  const index = GAMES.findIndex((g) => g.id === id);
  return index === -1 ? 0 : index;
}

function main() {
  const args = process.argv.slice(2);
  const stateAt = args.indexOf('--state');
  const stateFile = stateAt === -1 ? null : args.splice(stateAt, 2)[1];

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('play.js doit être lancé dans un terminal interactif.');
    process.exit(1);
  }

  let index = resolveGame(args[0], loadConfig());
  const sh = createShell(stateFile);
  let current = GAMES[index].start(sh);
  sh.onSwitch(() => {
    current.stop();
    index = (index + 1) % GAMES.length;
    current = GAMES[index].start(sh);
  });
}

if (require.main === module) main();

module.exports = { resolveGame };
