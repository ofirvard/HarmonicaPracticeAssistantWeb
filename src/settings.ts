import { keyByName } from './core/harmonica';

export interface Settings {
  keyName: string;
  spacing: number; // horizontal px per note
  noteScale: number; // multiplier on the default notehead size
  annotationSize: number; // font px for hole, letter and lyric labels
  showHoles: boolean;
  showLetters: boolean;
  sidebarWidth: number; // px
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  keyName: 'C',
  spacing: 80,
  noteScale: 1,
  annotationSize: 12,
  showHoles: true,
  showLetters: true,
  sidebarWidth: 220,
};

export const LIMITS = {
  spacing: { min: 40, max: 160 },
  noteScale: { min: 0.5, max: 2 },
  annotationSize: { min: 8, max: 24 },
  sidebarWidth: { min: 120, max: 600 },
} as const;

const STORAGE_KEY = 'harmonica-settings';

function number(value: unknown, fallback: number, { min, max }: { min: number; max: number }) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Reads saved settings, falling back per field so one bad value doesn't reset everything. */
export function loadSettings(storage: Pick<Storage, 'getItem'>): Settings {
  let saved: Partial<Record<keyof Settings, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') {
      saved = parsed;
    }
  } catch {
    // Storage blocked or corrupt: the defaults below still give a working app.
  }
  const d = DEFAULT_SETTINGS;
  return {
    keyName:
      typeof saved.keyName === 'string' && keyByName(saved.keyName) ? saved.keyName : d.keyName,
    spacing: number(saved.spacing, d.spacing, LIMITS.spacing),
    noteScale: number(saved.noteScale, d.noteScale, LIMITS.noteScale),
    annotationSize: number(saved.annotationSize, d.annotationSize, LIMITS.annotationSize),
    showHoles: boolean(saved.showHoles, d.showHoles),
    showLetters: boolean(saved.showLetters, d.showLetters),
    sidebarWidth: number(saved.sidebarWidth, d.sidebarWidth, LIMITS.sidebarWidth),
  };
}

export function saveSettings(storage: Pick<Storage, 'setItem'>, settings: Settings): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: settings just won't survive a reload.
  }
}
