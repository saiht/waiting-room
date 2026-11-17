export type GameId = 'snake' | 'typing'

/** Où en est Claude : au repos, au travail, ou tour terminé. */
export type Phase = {
  state: 'idle' | 'working' | 'done'
  /** Début du tour, en millisecondes depuis l'époque. */
  since: number
  /** Fin du tour (0 tant qu'il n'est pas fini). */
  at: number
}

export type Best = { snake: number; typing: number }

/** Ce que le hook de dessin transmet au module du jeu. */
export type GameProps = {
  game: GameId
  phase: Phase
  best: Best
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
    }
  }
}
