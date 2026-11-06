import { describe, expect, it } from 'vitest';
import { Bend } from './harmonica';
import { parseHoleLine, parseLyricLine, parseSong, type SongHole } from './songParser';

const holes = (...numbers: number[]): SongHole[] =>
  numbers.map((number) => ({ number, bend: Bend.NONE }));

describe('parseSong', () => {
  it('makes one song line per hole-only line', () => {
    expect(parseSong('4 -4 5 6\n5 -4 4\n')).toEqual([
      { holes: holes(4, -4, 5, 6), words: [] },
      { holes: holes(5, -4, 4), words: [] },
    ]);
  });

  it('attaches a lyric line to the preceding hole line', () => {
    expect(parseSong('7 -7 -6 6 -5\nFly me to the moon\n6 -6\n')).toEqual([
      { holes: holes(7, -7, -6, 6, -5), words: ['Fly', 'me', 'to', 'the', 'moon'] },
      { holes: holes(6, -6), words: [] },
    ]);
  });

  it('ignores text not following a hole line', () => {
    expect(parseSong('My Song Title\n\n4 5\nla la\nextra text\n')).toEqual([
      { holes: holes(4, 5), words: ['la', 'la'] },
    ]);
  });

  it('treats a blank line between holes and text as no lyrics', () => {
    expect(parseSong('4 5\n\nla la\n')).toEqual([{ holes: holes(4, 5), words: [] }]);
  });

  it('handles CRLF and extra whitespace', () => {
    expect(parseSong('  4   -4\t5 \r\n  one two  three \r\n')).toEqual([
      { holes: holes(4, -4, 5), words: ['one', 'two', 'three'] },
    ]);
  });

  it('returns nothing for empty input', () => {
    expect(parseSong('')).toEqual([]);
    expect(parseSong('\n\n  \n')).toEqual([]);
  });

  it('keeps a line with bends as notes instead of swallowing it as lyrics', () => {
    expect(parseSong("4 -4 5\n-3' 4\n")).toEqual([
      { holes: holes(4, -4, 5), words: [] },
      { holes: [{ number: -3, bend: Bend.HALF_STEP }, { number: 4, bend: Bend.NONE }], words: [] },
    ]);
  });

  it('does not read ordinal lyrics as hole numbers', () => {
    expect(parseSong('4 5\n2nd 3rd\n')).toEqual([{ holes: holes(4, 5), words: ['2nd', '3rd'] }]);
  });
});

describe('parseHoleLine', () => {
  it('requires every token to be a hole', () => {
    expect(parseHoleLine('4 -4 10')).toEqual(holes(4, -4, 10));
    expect(parseHoleLine('4 -4 x')).toEqual([]);
    expect(parseHoleLine('   ')).toEqual([]);
  });

  it('rejects numbers outside the hole range', () => {
    expect(parseHoleLine('0 4')).toEqual([]);
    expect(parseHoleLine('4 11')).toEqual([]);
    expect(parseHoleLine('1e1')).toEqual([]);
  });

  it('accepts every bend depth that exists', () => {
    expect(parseHoleLine(`-3' -3" -3"' 10"`)).toEqual([
      { number: -3, bend: Bend.HALF_STEP },
      { number: -3, bend: Bend.WHOLE_STEP },
      { number: -3, bend: Bend.STEP_AND_A_HALF },
      { number: 10, bend: Bend.WHOLE_STEP },
    ]);
  });

  it('rejects bends a hole does not have', () => {
    expect(parseHoleLine("4'")).toEqual([]);
    expect(parseHoleLine('-5"')).toEqual([]);
  });
});

describe('parseLyricLine', () => {
  it('splits hyphenated words into marked syllables', () => {
    expect(parseLyricLine('a-mong the')).toEqual(['a-', '-mong', 'the']);
    expect(parseLyricLine('beau-ti-ful')).toEqual(['beau-', '-ti-', '-ful']);
  });

  it('does not produce empty syllables from stray hyphens', () => {
    expect(parseLyricLine('well - done')).toEqual(['well', 'done']);
    expect(parseLyricLine('a--b')).toEqual(['a-', '-b']);
    expect(parseLyricLine('end-')).toEqual(['end']);
  });
});
