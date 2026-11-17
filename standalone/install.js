#!/usr/bin/env node
'use strict';
// Branche waiting-claude dans les réglages de Claude Code (hooks + barre de statut).
//
//   node install.js                        → ~/.claude/settings.json (toutes les sessions)
//   node install.js --settings <fichier>   → un autre fichier de réglages (ex. un projet)
//   node install.js --uninstall [--settings <fichier>]
//
// Une barre de statut déjà en place est conservée : elle s'affiche au-dessus de l'animation,
// et elle est restaurée à la désinstallation.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readJson } = require('./config');

const EVENTS = { UserPromptSubmit: null, Stop: null, Notification: 'permission_prompt', SessionEnd: null };
const CONFIG_FILE = path.join(__dirname, 'config.json');

const command = (script) => `"${process.execPath}" "${path.join(__dirname, script)}"`;
const isOurs = (cmd) => typeof cmd === 'string' && cmd.includes(__dirname);

function install(settings, config) {
  const current = settings.statusLine;
  if (current && current.command && !isOurs(current.command)) {
    config.statuslineBase = current.command;
    config.previousStatusLine = current;
  }
  settings.statusLine = {
    type: 'command',
    command: command('statusline.js'),
    padding: current && current.padding !== undefined ? current.padding : 0,
    refreshInterval: 1,
  };

  settings.hooks = settings.hooks || {};
  for (const [event, matcher] of Object.entries(EVENTS)) {
    const entries = (settings.hooks[event] = settings.hooks[event] || []);
    if (entries.some((e) => (e.hooks || []).some((h) => isOurs(h.command)))) continue;
    const entry = { hooks: [{ type: 'command', command: command('hook.js') }] };
    if (matcher) entry.matcher = matcher;
    entries.push(entry);
  }
}

function uninstall(settings, config) {
  if (settings.statusLine && isOurs(settings.statusLine.command)) {
    if (config.previousStatusLine) settings.statusLine = config.previousStatusLine;
    else delete settings.statusLine;
    delete config.previousStatusLine;
    delete config.statuslineBase;
  }
  for (const event of Object.keys(settings.hooks || {})) {
    settings.hooks[event] = settings.hooks[event]
      .map((e) => ({ ...e, hooks: (e.hooks || []).filter((h) => !isOurs(h.command)) }))
      .filter((e) => e.hooks.length);
    if (!settings.hooks[event].length) delete settings.hooks[event];
  }
  if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--settings');
  const file = path.resolve(at === -1 ? path.join(os.homedir(), '.claude', 'settings.json') : args[at + 1]);
  const removing = args.includes('--uninstall');

  let settings = {};
  if (fs.existsSync(file)) {
    try {
      settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`${file} n'est pas un JSON valide, je n'y touche pas : ${e.message}`);
      process.exit(1);
    }
    fs.copyFileSync(file, `${file}.waiting-claude.bak`);
  }
  const config = readJson(CONFIG_FILE, {});

  (removing ? uninstall : install)(settings, config);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`${removing ? 'Désinstallé de' : 'Installé dans'} ${file}`);
  if (fs.existsSync(`${file}.waiting-claude.bak`)) console.log(`Sauvegarde : ${file}.waiting-claude.bak`);
  if (!removing) console.log('Relance Claude Code (ou ouvre /hooks) pour que les hooks soient pris en compte.');
}

if (require.main === module) main();

module.exports = { install, uninstall };
