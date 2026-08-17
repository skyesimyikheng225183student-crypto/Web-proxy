export const EASTER_EGG_CODES = {
  barrelRoll: 'barrel roll',
  doAFlip: 'do_a_flip',
  glitch: 'unstable_not_smp',
  terminal: 'ye_olde',
  retro: 'arcade',
} as const;

export type EasterEgg = keyof typeof EASTER_EGG_CODES;

const STORAGE_KEY = 'web-proxy-easter-eggs';

export function findEasterEgg(input: string): EasterEgg | null {
  const normalized = input.trim().toLowerCase();
  const entry = (Object.entries(EASTER_EGG_CODES) as [EasterEgg, string][]).find(
    ([, code]) => code.toLowerCase() === normalized,
  );
  return entry?.[0] ?? null;
}

export function getDiscoveredEasterEggs(): EasterEgg[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is EasterEgg => item in EASTER_EGG_CODES);
  } catch {
    return [];
  }
}

export function discoverEasterEgg(egg: EasterEgg): EasterEgg[] {
  const current = getDiscoveredEasterEggs();
  if (current.includes(egg)) return current;
  const next = [...current, egg];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Discovery still works for the current session if storage is unavailable.
  }
  return next;
}

export function allCoreEasterEggsDiscovered(eggs: EasterEgg[]): boolean {
  return (Object.keys(EASTER_EGG_CODES) as EasterEgg[]).every((egg) => eggs.includes(egg));
}
