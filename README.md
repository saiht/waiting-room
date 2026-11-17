# waiting-room

De quoi patienter pendant que Claude Code travaille, dans l'esprit du petit jeu qu'on lance quand la page ne charge pas.

- **Mini-jeux dans un panneau de Claude Code** : un snake, un test de vitesse de frappe, une course d'obstacles et une course auto vue du cockpit. Le panneau s'ouvre tout seul quand Claude travaille depuis un moment, et un bandeau prévient quand il a fini ou qu'il attend une réponse.
- **Un tamagotchi dans la barre de statut** : il mange les tâches que Claude termine, grandit, a faim quand tu t'absentes et boude quand tu laisses Claude attendre une permission.
- **Animation dans la barre de statut** : un petit coureur, une vague ou un serpent pendant le travail, avec le temps écoulé.
- **Paramétrable** depuis `/config` : jeu et animation fixes ou tirés au sort chaque jour, délai avant l'ouverture du jeu, fermeture automatique.

Tout tourne en local : **aucun token consommé**, rien n'est ajouté au contexte de Claude.

Projet personnel, sans lien avec Anthropic.

## Installation

Dans une session Claude Code, au prompt :

```
/plugin install waiting-room --marketplace saiht/waiting-room
```

Réponds `y` pour ajouter la source, choisis la portée (« user » pour l'avoir dans toutes tes sessions), règle les options proposées : le mod est actif tout de suite.

Depuis un shell, l'équivalent est `claude plugin install waiting-room --marketplace saiht/waiting-room`.

Le mod s'appuie sur l'API des mods de Claude Code, encore en accès anticipé : elle peut changer d'une version à l'autre. Développé et testé avec Claude Code 2.1.326. Si ta version ne la propose pas, utilise la [version autonome](#version-autonome-sans-mod).

## Utilisation

Lance une tâche. Au bout du délai réglé (5 secondes par défaut), le panneau de jeu s'ouvre.

1. Le panneau demande le clavier à son ouverture. Claude Code ne le lui donne que si ton prompt est vide ; si le jeu ne répond pas, **clique dedans**.
2. **Espace** pour démarrer : rien ne bouge avant. Le test de frappe, lui, démarre au premier caractère juste.
3. **Échap** rend le clavier à Claude. Le panneau reste ouvert, tu peux y revenir d'un clic.

| Touche | Action |
| --- | --- |
| `Espace` | démarrer, puis mettre en pause (snake) ou sauter (course) |
| flèches ou `ZQSD` / `WASD` | diriger le serpent |
| `Entrée` | rejouer / phrase suivante |
| `←` `→` ou `Q` `D` | tourner le volant (course auto) |
| `P` | mettre une course en pause |
| `Tab` | passer au jeu suivant (snake, frappe, course d'obstacles, course auto, tamagotchi) |
| `Échap` | rendre le clavier à Claude |

Si Claude ouvre une boîte de dialogue (permission, question), le snake se met en pause et le bandeau l'indique.

### La commande `/waiting`

| Commande | Effet |
| --- | --- |
| `/waiting` | ouvre le panneau avec le jeu du moment, même si Claude ne travaille pas |
| `/waiting snake` | ouvre le snake, et le garde pour la session |
| `/waiting typing` | ouvre le test de frappe, et le garde pour la session |
| `/waiting runner` | ouvre la course d'obstacles, et la garde pour la session |
| `/waiting racer` | ouvre la course auto, et la garde pour la session |
| `/waiting pet` | ouvre la vue du tamagotchi |
| `/waiting close` | ferme le panneau |

Sur un terminal étroit (moins de 144 colonnes), Claude Code n'ouvre pas de panneau sans qu'on le demande : un message te propose alors `/waiting`, qui l'ouvre à n'importe quelle largeur.

## La course auto

Une route en fausse 3D, vue du cockpit : elle tourne, les montagnes défilent dans les virages, et il faut doubler les autres voitures sans les toucher.

```
╭────────────────────────────────────────────────────────╮
│                  ·                      ·              │
│                                                        │
│▁▁▂▃▂▁▁▁▁▂▃▄▃▂▁▁▁▂▃▂▁▁▁▂▄▅▄▂▁▁▂▃▂▁▁▁▁▂▃▄▃▂▁▁▁▂▃▂▁▁▁▂▄▅▄▂│
│░░░░░░░░░░░░░░░░░░░░░░█ ▪ █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█  ·  ┊  ·  █▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│░░░░░░░░░░░░░░░█      ▟█▙         █░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░█      ·      ┊      ·      █░░░░░░░░░░░░░░░│
│▒▒▒▒▒▒▒▒█                                  █▒▒▒▒▒▒▒▒▒▒▒▒│
│▒▒▒▒▒██         ·          ┊          ·       ██▒▒▒▒▒▒▒▒│
│░░██                                             ██░░░░░│
│██           ·             ┊             ·          ██░░│
│                 ▟▀▀▀▀▀▀▀▀(┼)▀▀▀▀▀▀▀▀▀▙                 │
╰────────────────────────────────────────────────────────╯
```

- La voiture accélère toute seule, de plus en plus vite avec le score.
- Dans un virage, elle est déportée vers l'extérieur : tourne dans le sens du virage pour rester en piste.
- Dans l'herbe, elle ralentit. Toucher une autre voiture met fin à la partie.

## Le tamagotchi

Il vit dans la barre de statut, sous le prompt, et se garde d'une session à l'autre.

| Ce qui se passe | Effet |
| --- | --- |
| Claude termine une tâche | un repas : la faim baisse, l'humeur monte, il gagne de l'expérience (plus Claude a utilisé d'outils, plus le repas est copieux) |
| Le temps passe | la faim revient, en 17 heures environ ; affamé, il s'attriste |
| Une boîte de dialogue de Claude (permission, question) attend plus de 30 secondes | il boude pendant 10 minutes et perd de l'humeur |

Il commence en œuf, éclot après quelques tâches, puis grandit : bébé, ado, adulte, sage. Il ne meurt pas.

### Sa vue dans le panneau

`/waiting pet` (ou `Tab` depuis un jeu) l'ouvre : il y est dessiné en grand, il cligne des yeux, sautille quand il est content, tremble quand il a faim.

```
╭────────────────────────────────────────────╮
│              ♥       ♥                     │
│                .-----.                     │
│               (  ♥ᴗ♥  )                    │
│                `-----'                     │
│                 U   U                      │
│  🐛                               🍪 × 3   │
╰────────────────────────────────────────────╯
« Rrrr… »
faim ▰▰▰▰▱ 78 %   humeur ▰▰▰▰▰ 92 %
[Espace] caresser  [F] friandise  [J] jouer  [N] nettoyer
```

| Touche | Action |
| --- | --- |
| `Espace` | le caresser : l'humeur remonte, et il pardonne s'il boudait |
| `F` | lui donner un cookie. Claude en rapporte un par tâche terminée, cinq au plus en réserve |
| `J` | jouer : il cache un cookie dans une main, devine laquelle avec `←` ou `→` |
| `N` | nettoyer : un repas sur quatre, il laisse un bug derrière lui, et les bugs qui traînent l'attristent |

## Réglages

Dans `/config`, section du mod :

| Réglage | Valeurs | Défaut |
| --- | --- | --- |
| **Jeu** | `random-daily` (tirage du jour entre les quatre jeux), `snake`, `typing`, `runner`, `racer`, `pet`, `off` | `random-daily` |
| **Délai avant le jeu (secondes)** | un nombre | `5` |
| **Animation de la barre de statut** | `random-daily`, `runner`, `wave`, `serpent`, `off` | `random-daily` |
| **Fermer le jeu quand Claude a fini** | oui / non | non |
| **Tamagotchi** | oui / non | oui |
| **Nom du tamagotchi** | un texte | `Mochi` |

Quelques réglages types :

- **Jouer seulement pendant les longues tâches** : délai à `120`. Le panneau ne s'ouvre que si Claude travaille encore au bout de deux minutes.
- **Seulement l'animation** : jeu sur `off`. `/waiting` reste disponible pour jouer à la demande.
- **Ne pas être tenté de finir sa partie** : active la fermeture automatique.

Les records sont conservés d'une session à l'autre.

## Version autonome (sans mod)

Le dossier [`standalone/`](standalone/) contient la première version : des scripts Node sans dépendance, branchés sur les hooks classiques et la barre de statut de Claude Code. Le jeu s'ouvre dans un panneau du terminal, à côté de Claude (iTerm2 ; tmux prévu mais pas encore testé).

```bash
git clone https://github.com/saiht/waiting-room.git
cd waiting-room/standalone
node install.js            # ajoute hooks et barre de statut à ~/.claude/settings.json
node install.js --uninstall
```

Une barre de statut déjà en place est conservée et restaurée à la désinstallation. Les réglages sont dans `standalone/config.json` (`game`, `games`, `delaySeconds`, `statusline`), et `node play.js [snake|typing]` lance un jeu à la main dans n'importe quel terminal.

N'active pas les deux versions en même temps : elles feraient doublon.

## Développement

```
.claude-plugin/   manifeste du mod (réglages) et fichier marketplace
hooks/register.tsx  événements de Claude Code : tours, commande, barre de statut, panneau
hooks/game.tsx      les jeux et la vue du tamagotchi, dessinés dans le panneau
hooks/pet.ts        la logique du tamagotchi
types/            contrat des valeurs d'état
tests/            tests du mod
standalone/       version autonome et ses tests
```

```bash
claude --plugin-dir .          # essayer le mod depuis le dossier
claude plugin validate .       # vérifier le manifeste et le module
claude plugin test .           # tests du mod
(cd standalone && npm test)    # tests de la version autonome
```

Ajouter un jeu au mod : sa logique et son dessin dans `hooks/game.tsx`, son identifiant dans `types/index.d.ts` et dans les options de `game` du manifeste.

## Idées pour la suite

- **Le pari** : parier sur la durée ou le nombre d'outils que Claude va utiliser, score à la fin.
- **Snake alimenté par l'agent** : chaque appel d'outil fait apparaître une pomme, chaque erreur un obstacle.
- **Bingo** : une grille de cases (« lance les tests », « se trompe de chemin », « modifie 3 fichiers ») qui se cochent toutes seules.
- **Démineur** et **jeu de fusion de tuiles**, au tour par tour.
- **Question du moment** : quiz ou flashcard (raccourcis, git, culture dev) à chaque attente.
- **Messages d'attente personnalisés** à la place des verbes du spinner.
- **Compteur du temps d'attente cumulé** et succès à débloquer.

## Licence

MIT.
