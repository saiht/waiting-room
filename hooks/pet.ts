// Le tamagotchi : logique pure, sans accès au moteur.
// Il mange les tâches que Claude termine, a faim avec le temps qui passe,
// et boude quand on laisse Claude attendre une réponse.
import type { Pet, PetMood, PetStage, PetView } from '../types'

const HOUR = 3_600_000
/** Au-delà, laisser Claude attendre une permission le fait bouder. */
export const SULK_AFTER_MS = 30_000
const SULK_FOR_MS = 10 * 60_000
const STROKE_EVERY_MS = 20_000

const STAGES: readonly { stage: PetStage; label: string; fromXp: number }[] = [
  { stage: 'egg', label: 'œuf', fromXp: 0 },
  { stage: 'baby', label: 'bébé', fromXp: 3 },
  { stage: 'teen', label: 'ado', fromXp: 30 },
  { stage: 'adult', label: 'adulte', fromXp: 120 },
  { stage: 'sage', label: 'sage', fromXp: 400 },
]

const FACES: Record<PetMood, string> = {
  happy: '•ᴗ•',
  neutral: '•‿•',
  hungry: '•﹏•',
  sad: '•︵•',
  sulking: '¬_¬',
  eating: '^ڡ^',
  loved: '♥ᴗ♥',
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

export function newPet(now: number): Pet {
  return {
    bornAt: now, updatedAt: now,
    xp: 0, meals: 0,
    satiety: 70, happiness: 70,
    sulkUntil: 0, lastMealAt: 0, lastStrokeAt: 0,
    words: 'Un œuf. Il éclora après quelques tâches.',
  }
}

/** Relit ce qui a été stocké : tout champ absent ou abîmé repart d'un œuf neuf. */
export function restorePet(stored: unknown, now: number): Pet {
  const fresh = newPet(now)
  if (typeof stored !== 'object' || stored === null) return fresh
  const held = stored as Record<string, unknown>
  const pet: Record<string, unknown> = { ...fresh }
  for (const key of Object.keys(fresh)) {
    const value = held[key]
    const isKept = key === 'words'
      ? typeof value === 'string'
      : typeof value === 'number' && Number.isFinite(value)
    if (!isKept) return fresh
    pet[key] = value
  }

  return pet as Pet
}

/** Le temps qui passe : la faim vient en 17 heures environ, et affamé il s'attriste. */
export function age(pet: Pet, now: number): Pet {
  const hours = Math.max(0, now - pet.updatedAt) / HOUR
  const satiety = clamp(pet.satiety - 6 * hours)
  const happiness = satiety < 20 ? clamp(pet.happiness - 3 * hours) : pet.happiness

  return { ...pet, satiety, happiness, updatedAt: now }
}

export function stageOf(xp: number): { stage: PetStage; label: string; nextXp: number | null } {
  let index = 0
  STAGES.forEach((one, i) => { if (xp >= one.fromXp) index = i })
  const current = STAGES[index] ?? { stage: 'egg' as const, label: 'œuf' }

  return { stage: current.stage, label: current.label, nextXp: STAGES[index + 1]?.fromXp ?? null }
}

/** Une tâche terminée est un repas, d'autant plus copieux que Claude a utilisé d'outils. */
export function feed(pet: Pet, now: number, tools: number): Pet {
  const aged = age(pet, now)
  const gain = 1 + Math.min(10, Math.max(0, tools))
  const before = stageOf(aged.xp)
  const after = stageOf(aged.xp + gain)
  const words = after.stage !== before.stage
    ? before.stage === 'egg' ? 'Il a éclos !' : `Il a grandi : le voilà ${after.label} !`
    : before.stage === 'egg' ? 'L\'œuf a bougé…'
    : tools > 0 ? `Miam, ${tools} outil${tools > 1 ? 's' : ''} !` : 'Miam !'

  return {
    ...aged,
    xp: aged.xp + gain,
    meals: aged.meals + 1,
    satiety: clamp(aged.satiety + 12 + Math.min(28, tools * 2)),
    happiness: clamp(aged.happiness + 4),
    sulkUntil: 0, // un bon repas, et c'est oublié
    lastMealAt: now,
    words,
  }
}

/** Claude a attendu une réponse trop longtemps. */
export function sulk(pet: Pet, now: number, waitedMs: number): Pet {
  const aged = age(pet, now)
  const seconds = Math.round(waitedMs / 1000)
  const waited = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`

  return {
    ...aged,
    happiness: clamp(aged.happiness - 15),
    sulkUntil: now + SULK_FOR_MS,
    words: `Hmpf. Claude t'a attendu ${waited}.`,
  }
}

/** Une caresse : elle console, mais ne compte qu'une fois de temps en temps. */
export function stroke(pet: Pet, now: number): Pet {
  const aged = age(pet, now)
  const counts = now - aged.lastStrokeAt >= STROKE_EVERY_MS
  const wasSulking = now < aged.sulkUntil

  return {
    ...aged,
    happiness: counts ? clamp(aged.happiness + 6) : aged.happiness,
    sulkUntil: 0,
    lastStrokeAt: now,
    words: wasSulking ? 'Bon… pardonné.' : 'Rrrr…',
  }
}

export function moodOf(pet: Pet, now: number): PetMood {
  if (now - pet.lastStrokeAt < 4000) return 'loved'
  if (now - pet.lastMealAt < 8000) return 'eating'
  if (now < pet.sulkUntil) return 'sulking'
  if (pet.satiety < 25) return 'hungry'
  if (pet.happiness < 30) return 'sad'

  return pet.happiness >= 60 ? 'happy' : 'neutral'
}

export function faceOf(stage: PetStage, mood: PetMood): string {
  const face = FACES[mood]
  switch (stage) {
    case 'egg': return mood === 'eating' || mood === 'loved' ? '(°)' : '( )'
    case 'baby': return `(${face})`
    case 'teen': return `ʕ${face}ʔ`
    case 'adult': return `ᕙ(${face})ᕗ`
    case 'sage': return `✧(${face})✧`
  }
}

/** Jauge de 5 crans pour une valeur de 0 à 100. */
export function gauge(value: number): string {
  const filled = Math.round(clamp(value) / 20)

  return '▰'.repeat(filled) + '▱'.repeat(5 - filled)
}

/** Ce que le panneau et la barre de statut affichent, à un instant donné. */
export function viewOf(pet: Pet, name: string, now: number, forcedMood?: PetMood): PetView {
  const aged = age(pet, now)
  const { stage, label, nextXp } = stageOf(aged.xp)
  const mood = forcedMood ?? moodOf(aged, now)
  const words = aged.satiety < 25 && mood === 'hungry' ? 'J\'ai faim… donne une tâche à Claude.' : aged.words

  return {
    name, stage, stageLabel: label, mood,
    face: faceOf(stage, mood),
    satiety: Math.round(aged.satiety),
    happiness: Math.round(aged.happiness),
    xp: aged.xp, nextXp,
    meals: aged.meals,
    ageDays: Math.floor((now - aged.bornAt) / (24 * HOUR)),
    words,
  }
}

/** La ligne de repos de la barre de statut. */
export function statusOf(view: PetView): string {
  return `${view.face} ${view.name}  faim ${gauge(view.satiety)}  humeur ${gauge(view.happiness)}`
}
