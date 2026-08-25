export type WorldStatus = "WAITING" | "ACTIVE" | "COMPLETE" | "CANCELLED";
export type WorldPhase =
  | "WAITING"
  | "QUEST"
  | "LAST_QUILL"
  | "PEACE"
  | "SURVIVOR"
  | "CANCELLED";
export type ObjectiveStatus = "LOCKED" | "ACTIVE" | "COMPLETED" | "FAILED";
export type OutcomeType = "" | "PEACE" | "SURVIVOR";

export type Constraint = {
  category: string;
  difficulty: number;
  instruction: string;
  criteria: string[];
};

export type StoryEntry = {
  scene: number;
  kind: "PROLOGUE" | "SCENE" | "FATE";
  author: string;
  character: string;
  text: string;
};

export type TurnAttempt = {
  turn: number;
  scene: number;
  player: string;
  character: string;
  text: string;
  accepted: boolean;
  reason: string;
  violatedLaws: number[];
  objectiveProgress: boolean[];
  objectiveAchieved: boolean;
  objectiveReason: string;
  constraint: Constraint;
};

export type WorldState = {
  worldKey: string;
  worldName: string;
  host: string;
  premise: string;
  opening: string;
  worldLaws: string[];
  objective: string;
  objectiveCriteria: string[];
  objectiveProgress: boolean[];
  objectiveReason: string;
  objectiveStatus: ObjectiveStatus;
  objectiveUnlockScene: number;
  objectiveDeadlineScene: number;
  status: WorldStatus;
  phase: WorldPhase;
  outcomeType: OutcomeType;
  winner: string;
  survivors: string[];
  outcomeReason: string;
  maxPlayers: number;
  startingInk: number;
  turnWindowSeconds: number;
  turnStartedAt: string;
  turnDeadline: string;
  players: string[];
  characters: string[];
  characterNotes: string[];
  ink: number[];
  scores: number[];
  eliminatedAtScene: number[];
  currentPlayerIndex: number;
  activePlayer: string;
  turn: number;
  currentScene: number;
  revision: number;
  currentConstraint: Constraint | null;
  categoryHistory: string[];
  story: StoryEntry[];
  attempts: TurnAttempt[];
  lastEvent: string;
};

export type WorldSummary = {
  worldKey: string;
  worldName: string;
  host: string;
  premise: string;
  status: WorldStatus;
  phase: WorldPhase;
  playerCount: number;
  survivorCount: number;
  maxPlayers: number;
  turnWindowSeconds: number;
  turnDeadline: string;
  currentScene: number;
  objective: string;
  objectiveStatus: ObjectiveStatus;
  objectiveUnlockScene: number;
  objectiveDeadlineScene: number;
  revision: number;
};

export type PlayerProfile = {
  player: string;
  worldsPlayed: number;
  acceptedScenes: number;
  peacefulWins: number;
  survivorWins: number;
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, label = "object"): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Contract returned an invalid ${label}`);
  }
  return value as UnknownRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${label}`);
  return value;
}

function numberValue(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${label}`);
  return parsed;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Invalid ${label}`);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value.map((item, index) => text(item, `${label}[${index}]`));
}

function numberArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value.map((item, index) => numberValue(item, `${label}[${index}]`));
}

function booleanArray(value: unknown, label: string): boolean[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value.map((item, index) => booleanValue(item, `${label}[${index}]`));
}

function worldStatus(value: unknown): WorldStatus {
  const parsed = text(value, "world status");
  if (!["WAITING", "ACTIVE", "COMPLETE", "CANCELLED"].includes(parsed)) {
    throw new Error("Invalid world status");
  }
  return parsed as WorldStatus;
}

function worldPhase(value: unknown): WorldPhase {
  const parsed = text(value, "world phase");
  if (![
    "WAITING",
    "QUEST",
    "LAST_QUILL",
    "PEACE",
    "SURVIVOR",
    "CANCELLED",
  ].includes(parsed)) {
    throw new Error("Invalid world phase");
  }
  return parsed as WorldPhase;
}

function objectiveStatus(value: unknown): ObjectiveStatus {
  const parsed = text(value, "objective status");
  if (!["LOCKED", "ACTIVE", "COMPLETED", "FAILED"].includes(parsed)) {
    throw new Error("Invalid objective status");
  }
  return parsed as ObjectiveStatus;
}

function outcomeType(value: unknown): OutcomeType {
  const parsed = text(value, "outcome type");
  if (!["", "PEACE", "SURVIVOR"].includes(parsed)) {
    throw new Error("Invalid outcome type");
  }
  return parsed as OutcomeType;
}

function parseConstraint(value: unknown, optional = false): Constraint | null {
  const candidate = record(value, "constraint");
  if (optional && Object.keys(candidate).length === 0) return null;
  return {
    category: text(candidate.category, "constraint category"),
    difficulty: numberValue(candidate.difficulty, "constraint difficulty"),
    instruction: text(candidate.instruction, "constraint instruction"),
    criteria: stringArray(candidate.criteria, "constraint criteria"),
  };
}

function parseStoryEntry(value: unknown): StoryEntry {
  const candidate = record(value, "story entry");
  const kind = text(candidate.kind, "story kind");
  if (!["PROLOGUE", "SCENE", "FATE"].includes(kind)) {
    throw new Error("Invalid story kind");
  }
  return {
    scene: numberValue(candidate.scene, "story scene"),
    kind: kind as StoryEntry["kind"],
    author: text(candidate.author, "story author"),
    character: text(candidate.character, "story character"),
    text: text(candidate.text, "story text"),
  };
}

function parseAttempt(value: unknown): TurnAttempt {
  const candidate = record(value, "turn attempt");
  const parsedConstraint = parseConstraint(candidate.constraint);
  if (!parsedConstraint) throw new Error("Attempt is missing its constraint");
  return {
    turn: numberValue(candidate.turn, "attempt turn"),
    scene: numberValue(candidate.scene, "attempt scene"),
    player: text(candidate.player, "attempt player"),
    character: text(candidate.character, "attempt character"),
    text: text(candidate.text, "attempt text"),
    accepted: booleanValue(candidate.accepted, "attempt verdict"),
    reason: text(candidate.reason, "attempt reason"),
    violatedLaws: numberArray(candidate.violated_laws, "violated laws"),
    objectiveProgress: booleanArray(candidate.objective_progress, "objective progress"),
    objectiveAchieved: booleanValue(candidate.objective_achieved, "objective achievement"),
    objectiveReason: text(candidate.objective_reason, "objective reason"),
    constraint: parsedConstraint,
  };
}

export function parseWorldState(value: unknown): WorldState {
  const candidate = record(value, "world");
  if (!Array.isArray(candidate.story) || !Array.isArray(candidate.attempts)) {
    throw new Error("Invalid world history");
  }
  return {
    worldKey: text(candidate.world_key, "world key"),
    worldName: text(candidate.world_name, "world name"),
    host: text(candidate.host, "world host"),
    premise: text(candidate.premise, "world premise"),
    opening: text(candidate.opening, "world opening"),
    worldLaws: stringArray(candidate.world_laws, "world laws"),
    objective: text(candidate.objective, "world objective"),
    objectiveCriteria: stringArray(candidate.objective_criteria, "objective criteria"),
    objectiveProgress: booleanArray(candidate.objective_progress, "objective progress"),
    objectiveReason: text(candidate.objective_reason, "objective reason"),
    objectiveStatus: objectiveStatus(candidate.objective_status),
    objectiveUnlockScene: numberValue(candidate.objective_unlock_scene, "objective unlock scene"),
    objectiveDeadlineScene: numberValue(candidate.objective_deadline_scene, "objective deadline scene"),
    status: worldStatus(candidate.status),
    phase: worldPhase(candidate.phase),
    outcomeType: outcomeType(candidate.outcome_type),
    winner: text(candidate.winner, "world winner"),
    survivors: stringArray(candidate.survivors, "world survivors"),
    outcomeReason: text(candidate.outcome_reason, "outcome reason"),
    maxPlayers: numberValue(candidate.max_players, "maximum players"),
    startingInk: numberValue(candidate.starting_ink, "starting Ink"),
    turnWindowSeconds: numberValue(candidate.turn_window_seconds, "turn window"),
    turnStartedAt: text(candidate.turn_started_at, "turn start"),
    turnDeadline: text(candidate.turn_deadline, "turn deadline"),
    players: stringArray(candidate.players, "world players"),
    characters: stringArray(candidate.characters, "world characters"),
    characterNotes: stringArray(candidate.character_notes, "character notes"),
    ink: numberArray(candidate.ink, "writer Ink"),
    scores: numberArray(candidate.scores, "writer scores"),
    eliminatedAtScene: numberArray(candidate.eliminated_at_scene, "elimination scenes"),
    currentPlayerIndex: numberValue(candidate.current_player_index, "current player index"),
    activePlayer: text(candidate.active_player, "active player"),
    turn: numberValue(candidate.turn, "turn"),
    currentScene: numberValue(candidate.current_scene, "current scene"),
    revision: numberValue(candidate.revision, "revision"),
    currentConstraint: parseConstraint(candidate.current_constraint, true),
    categoryHistory: stringArray(candidate.category_history, "category history"),
    story: candidate.story.map(parseStoryEntry),
    attempts: candidate.attempts.map(parseAttempt),
    lastEvent: text(candidate.last_event, "last event"),
  };
}

function parseWorldSummary(value: unknown): WorldSummary {
  const candidate = record(value, "world summary");
  return {
    worldKey: text(candidate.world_key, "world key"),
    worldName: text(candidate.world_name, "world name"),
    host: text(candidate.host, "world host"),
    premise: text(candidate.premise, "world premise"),
    status: worldStatus(candidate.status),
    phase: worldPhase(candidate.phase),
    playerCount: numberValue(candidate.player_count, "player count"),
    survivorCount: numberValue(candidate.survivor_count, "survivor count"),
    maxPlayers: numberValue(candidate.max_players, "maximum players"),
    turnWindowSeconds: numberValue(candidate.turn_window_seconds, "turn window"),
    turnDeadline: text(candidate.turn_deadline, "turn deadline"),
    currentScene: numberValue(candidate.current_scene, "current scene"),
    objective: text(candidate.objective, "world objective"),
    objectiveStatus: objectiveStatus(candidate.objective_status),
    objectiveUnlockScene: numberValue(candidate.objective_unlock_scene, "objective unlock scene"),
    objectiveDeadlineScene: numberValue(candidate.objective_deadline_scene, "objective deadline scene"),
    revision: numberValue(candidate.revision, "revision"),
  };
}

export function parseWorldDirectory(value: unknown): WorldSummary[] {
  const candidate = record(value, "world directory");
  if (!Array.isArray(candidate.worlds)) throw new Error("Invalid world directory");
  return candidate.worlds.map(parseWorldSummary);
}

export function parseProfile(value: unknown): PlayerProfile {
  const candidate = record(value, "profile");
  return {
    player: text(candidate.player, "profile player"),
    worldsPlayed: numberValue(candidate.worlds_played, "worlds played"),
    acceptedScenes: numberValue(candidate.accepted_scenes, "accepted scenes"),
    peacefulWins: numberValue(candidate.peaceful_wins, "peaceful wins"),
    survivorWins: numberValue(candidate.survivor_wins, "survivor wins"),
  };
}

export function sameAddress(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

export function shortAddress(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
