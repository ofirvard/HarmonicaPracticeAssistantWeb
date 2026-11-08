import { describe, expect, it } from 'vitest';
import { Bend, Harmonica, keyByName } from './harmonica';
import { noteToFrequency } from './notes';
import { parseSong } from './songParser';
import { layoutLines, songToItems, toEntries, type StaffEntry, type StaffItem } from './staff';

const cHarp = new Harmonica(keyByName('C')!);
const gHarp = new Harmonica(keyByName('G')!);

function played(...notes: Array<[string, string, number]>): StaffItem {
  return {
    kind: 'played',
    notes: notes.map(([label, name, octave]) => ({
      name: label,
      frequencyHz: noteToFrequency(name, octave),
    })),
  };
}

function entry(endLine = false): StaffEntry {
  return { keys: ['c/5'], letters: 'C5', holes: '4', lyric: '', endLine };
}

describe('toEntries', () => {
  it('translates song holes, lyrics and line ends', () => {
    const items = songToItems(parseSong('4 -4\nla la-\n5\n'));
    expect(toEntries(items, cHarp)).toEqual([
      { keys: ['c/5'], letters: 'C5', holes: '4', lyric: 'la', endLine: false },
      { keys: ['d/5'], letters: 'D5', holes: '-4', lyric: 'la', endLine: true },
      { keys: ['e/5'], letters: 'E5', holes: '5', lyric: '', endLine: true },
    ]);
  });

  it('keeps bends from the song', () => {
    const [bent] = toEntries(songToItems(parseSong("-3'\n")), cHarp);
    expect(bent).toMatchObject({ keys: ['a#/4'], letters: 'A#4', holes: "-3'" });
  });

  it('re-pitches song holes when the key changes', () => {
    const items = songToItems(parseSong('4 -4\n'));
    expect(toEntries(items, gHarp).map((e) => e.letters)).toEqual(['G4', 'A4']);
    expect(toEntries(items, cHarp).map((e) => e.letters)).toEqual(['C5', 'D5']);
  });

  it('keeps the pitch of played notes when the key changes and only relabels the holes', () => {
    const items = [played(['C5', 'C', 5])];
    expect(toEntries(items, cHarp)[0]).toMatchObject({ letters: 'C5', holes: '4' });
    expect(toEntries(items, gHarp)[0]).toMatchObject({ letters: 'C5', holes: '-5' });
  });

  it('joins chords and marks notes with no hole', () => {
    const items = [played(['C5', 'C', 5], ['D#5', 'D#', 5])];
    expect(toEntries(items, cHarp)[0]).toMatchObject({
      keys: ['c/5', 'd#/5'],
      letters: 'C5+D#5',
      holes: '4+n/a',
    });
  });

  it('labels a played blow 3 / draw 2 with both, but a song keeps the hole as written', () => {
    expect(toEntries([played(['G4', 'G', 4])], cHarp)[0]!.holes).toBe('3/-2');
    const song: StaffItem = {
      kind: 'hole',
      hole: { number: -2, bend: Bend.NONE },
      word: '',
      endLine: true,
    };
    expect(toEntries([song], cHarp)[0]!.holes).toBe('-2');
  });
});

describe('layoutLines', () => {
  const shape = (perLine: number, entries: StaffEntry[]) =>
    layoutLines(entries, perLine).map((l) => [l.entries.length, l.startsPhrase]);

  it('returns nothing for no entries', () => {
    expect(layoutLines([], 4)).toEqual([]);
  });

  it('breaks at forced line ends', () => {
    expect(shape(10, [entry(), entry(true), entry()])).toEqual([[2, true], [1, true]]);
  });

  it('soft-wraps without starting a new phrase', () => {
    expect(shape(2, [entry(), entry(), entry()])).toEqual([[2, true], [1, false]]);
  });

  it('starts a phrase after a forced break that lands exactly on the wrap point', () => {
    expect(shape(2, [entry(), entry(true), entry()])).toEqual([[2, true], [1, true]]);
  });

  it('does not add an empty line after a trailing forced break', () => {
    expect(shape(4, [entry(true)])).toEqual([[1, true]]);
  });
});
