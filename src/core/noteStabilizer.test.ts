import { describe, expect, it } from 'vitest';
import { NoteStabilizer } from './noteStabilizer';
import type { DetectedNote } from './pitchDetector';

const note = (name: string): DetectedNote => ({ name, frequencyHz: 440 });
const hop = (...names: string[]) => names.map(note);
const committed = (result: DetectedNote[] | null) => result?.map((n) => n.name) ?? null;

describe('NoteStabilizer', () => {
  it('commits a note only once it appears in two consecutive hops', () => {
    const s = new NoteStabilizer();
    expect(s.push(hop('A4'))).toBeNull();
    expect(committed(s.push(hop('A4')))).toEqual(['A4']);
  });

  it('fires once for a held note', () => {
    const s = new NoteStabilizer();
    s.push(hop('A4'));
    s.push(hop('A4'));
    expect(s.push(hop('A4'))).toBeNull();
    expect(s.push(hop('A4'))).toBeNull();
  });

  it('ignores a one-hop blip', () => {
    const s = new NoteStabilizer();
    expect(s.push(hop('A4'))).toBeNull();
    expect(s.push(hop())).toBeNull();
    expect(s.push(hop('C5'))).toBeNull();
    expect(s.push(hop())).toBeNull();
  });

  it('commits the same note again after a gap of silence', () => {
    const s = new NoteStabilizer();
    s.push(hop('A4'));
    s.push(hop('A4'));
    s.push(hop());
    s.push(hop('A4'));
    expect(committed(s.push(hop('A4')))).toEqual(['A4']);
  });

  it('lets a chord note settle a hop later without losing the others', () => {
    const s = new NoteStabilizer();
    s.push(hop('C4'));
    expect(committed(s.push(hop('C4', 'E4')))).toEqual(['C4']);
    expect(committed(s.push(hop('C4', 'E4')))).toEqual(['C4', 'E4']);
  });

  it('does not treat what is left of a fading chord as a new note', () => {
    const s = new NoteStabilizer();
    s.push(hop('C5', 'E5', 'G5'));
    expect(committed(s.push(hop('C5', 'E5', 'G5')))).toEqual(['C5', 'E5', 'G5']);
    expect(s.push(hop('C5', 'G5'))).toBeNull();
    expect(s.push(hop('C5'))).toBeNull();
    expect(s.push(hop())).toBeNull();
  });

  it('commits a note added back to a chord that had thinned out', () => {
    const s = new NoteStabilizer();
    s.push(hop('C5', 'E5'));
    s.push(hop('C5', 'E5'));
    s.push(hop('C5'));
    s.push(hop('C5'));
    s.push(hop('C5', 'E5'));
    expect(committed(s.push(hop('C5', 'E5')))).toEqual(['C5', 'E5']);
  });
});
