import { describe, expect, it } from 'vitest';
import { HARMONICA_KEYS, Harmonica } from './harmonica';
import { noteToFrequency } from './notes';
import { parseSong } from './songParser';
import { songToItems, toEntries, type StaffItem } from './staff';
import { staffToTab } from './tabExport';

const played = (...names: string[]): StaffItem => ({
  kind: 'played',
  notes: names.map((name) => ({ name, frequencyHz: noteToFrequency(name.slice(0, -1), Number(name.at(-1))) })),
});

const reimport = (text: string) => songToItems(parseSong(text));

describe('staffToTab', () => {
  it('writes recorded notes as the notes played, chords joined by +', () => {
    const text = staffToTab([played('E5'), played('C5', 'E5', 'G5'), played('A3')], 'Title');
    expect(text).toBe('Title\n\nE5 C5+E5+G5 A3\n');
  });

  it('keeps a song line by line, with its lyrics and hyphenated words', () => {
    const song = "4 -4 5 6\nwhere a-mong us\n-6' 6\n";
    const text = staffToTab(reimport(song), 'Title');
    expect(text).toBe("Title\n\n4 -4 5 6\nwhere a-mong us\n\n-6' 6\n");
  });

  it('reads back to the same staff, song and recording mixed', () => {
    const items: StaffItem[] = [
      ...reimport('7 -7 -6\nFly me to\n4 5\n'),
      played('E5'),
      played('C4', 'E4'),
      played('A3'), // n/a on a C harp
      played('G4'), // 3/-2 on a C harp
      ...reimport('-4\n'),
    ];
    const back = reimport(staffToTab(items, 'Title'));
    expect(back).toEqual(items);
    const cHarp = new Harmonica(HARMONICA_KEYS[0]!);
    expect(toEntries(back, cHarp)).toEqual(toEntries(items, cHarp));
  });

  it('wraps long recordings without changing what reads back', () => {
    const items = Array.from({ length: 30 }, (_, i) => played(i % 2 ? 'C5' : 'D5'));
    const text = staffToTab(items, 'Title');
    expect(text.trim().split('\n\n')).toHaveLength(4); // title and 3 lines of up to 12
    expect(reimport(text)).toEqual(items);
  });

  it('keeps recorded notes at their pitch whatever key is selected on import', () => {
    const [item] = reimport(staffToTab([played('F#4')], 'Title'));
    const gHarp = new Harmonica(HARMONICA_KEYS.find((k) => k.name === 'G')!);
    expect(toEntries([item!], gHarp)[0]!.letters).toBe('F#4');
  });
});
