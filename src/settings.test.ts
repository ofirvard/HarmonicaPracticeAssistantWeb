import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, LIMITS, loadSettings, saveSettings } from './settings';

function fakeStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_: string, v: string) => {
      value = v;
    },
  };
}

describe('settings', () => {
  it('uses defaults when nothing is saved', () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', () => {
    const storage = fakeStorage();
    const settings = { ...DEFAULT_SETTINGS, keyName: 'Bb', spacing: 120, showHoles: false };
    saveSettings(storage, settings);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it('falls back to defaults for corrupt JSON', () => {
    expect(loadSettings(fakeStorage('{not json'))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(fakeStorage('null'))).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces only the invalid fields', () => {
    const saved = JSON.stringify({ keyName: 'H', spacing: 'wide', showLetters: false });
    expect(loadSettings(fakeStorage(saved))).toEqual({ ...DEFAULT_SETTINGS, showLetters: false });
  });

  it('clamps out-of-range numbers', () => {
    const saved = JSON.stringify({ spacing: 9999, noteScale: 0 });
    const settings = loadSettings(fakeStorage(saved));
    expect(settings.spacing).toBe(LIMITS.spacing.max);
    expect(settings.noteScale).toBe(LIMITS.noteScale.min);
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(blocked, DEFAULT_SETTINGS)).not.toThrow();
  });
});
