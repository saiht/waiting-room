export type GameId = 'snake' | 'typing' | 'pet'

/** Où en est Claude : au repos, au travail, ou tour terminé. */
export type Phase = {
  state: 'idle' | 'working' | 'done'
  /** Début du tour, en millisecondes depuis l'époque. */
  since: number
  /** Fin du tour (0 tant qu'il n'est pas fini). */
  at: number
}

export type Best = { snake: number; typing: number }

export type PetStage = 'egg' | 'baby' | 'teen' | 'adult' | 'sage'
export type PetMood = 'happy' | 'neutral' | 'hungry' | 'sad' | 'sulking' | 'eating' | 'loved'

/** Le tamagotchi tel qu'il est gardé d'une session à l'autre. */
export type Pet = {
  bornAt: number
  /** Dernier instant où la faim a été mise à jour. */
  updatedAt: number
  xp: number
  meals: number
  /** Satiété, de 0 (affamé) à 100. */
  satiety: number
  /** Humeur, de 0 à 100. */
  happiness: number
  /** Il boude jusqu'à cet instant (0 : il ne boude pas). */
  sulkUntil: number
  /** Friandises en réserve : Claude en rapporte une par tâche. */
  cookies: number
  /** Bugs qu'il a laissés et qui attendent d'être nettoyés. */
  bugs: number
  lastMealAt: number
  lastStrokeAt: number
  lastPlayAt: number
  /** Sa dernière réplique. */
  words: string
}

/** Le tamagotchi prêt à être dessiné. */
export type PetView = {
  name: string
  stage: PetStage
  stageLabel: string
  mood: PetMood
  face: string
  /** Les yeux et la bouche seuls, pour le dessin en grand. */
  expression: string
  satiety: number
  happiness: number
  xp: number
  /** Expérience du prochain stade ; null au dernier. */
  nextXp: number | null
  meals: number
  cookies: number
  bugs: number
  ageDays: number
  words: string
}

/** Ce que le hook de dessin transmet au module du jeu. */
export type GameProps = {
  game: GameId
  phase: Phase
  best: Best
  /** null quand le tamagotchi est désactivé. */
  pet: PetView | null
  /** Une boîte de dialogue de Claude attend une réponse (permission, question). */
  isCovered: boolean
  columns: number
}

declare module 'claude-code' {
  interface PluginState {
    'waiting-room': {
      phase: Shaped<Phase>
      /** Jeu choisi avec /waiting pour cette session ; '' = suivre le réglage. */
      game: string
      best: Shaped<Best>
      pet: Shaped<Pet>
    }
  }
}
