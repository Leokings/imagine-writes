const NUMBER_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
  "Twenty",
  "Twenty-One",
  "Twenty-Two",
  "Twenty-Three",
  "Twenty-Four",
] as const;

export function sceneLabel(scene: number): string {
  return `Scene ${NUMBER_WORDS[scene] ?? scene}`;
}

export function worldKeyFromName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 3 || normalized.length > 48) return null;
  if (!/[a-z]/i.test(normalized) || /[^a-z0-9 _'’-]/i.test(normalized)) return null;
  const key = normalized
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[ _-]+/g, "-")
    .replace(/^-|-$/g, "");
  return key.length >= 3 ? key : null;
}

export function categoryLabel(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function paceLabel(seconds: number): string {
  if (seconds === 300) return "Blitz · 5 min";
  if (seconds === 3_600) return "Campfire · 1 hour";
  if (seconds === 86_400) return "Chronicle · 24 hours";
  return `${seconds} seconds`;
}

export function phaseLabel(phase: string): string {
  if (phase === "QUEST") return "Quest for peace";
  if (phase === "LAST_QUILL") return "Last Quill";
  if (phase === "PEACE") return "Peaceful ending";
  if (phase === "SURVIVOR") return "Last survivor";
  if (phase === "WAITING") return "Gathering writers";
  return "World closed";
}

export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return "Time expired";
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}:${String(seconds).padStart(2, "0")} remaining`;
}
