import { describe, expect, it } from 'vitest';
import { Recording, RecordingList, encodeWav, toPcm16 } from './recordings';

describe('Recording', () => {
  it('keeps everything up to the limit, as 16-bit samples', () => {
    const recording = new Recording('C', 10);
    recording.push([0, 1], 4);
    recording.push([-1], 4);
    expect([...recording.samples()]).toEqual([0, 32767, -32768]);
    expect(recording.duration).toBe(0.75);
    expect(recording.sampleRate).toBe(4);
  });

  it('keeps only about the last maxSeconds of a long recording, oldest first', () => {
    const recording = new Recording('C', 1);
    recording.push([0.1, 0.1], 4);
    recording.push([0.2, 0.2], 4);
    recording.push([0.3, 0.3], 4);
    expect(recording.duration).toBe(1);
    expect([...recording.samples()]).toEqual([0.2, 0.2, 0.3, 0.3].map(toPcm16));
  });

  it('never drops the newest chunk, even one longer than the limit', () => {
    const recording = new Recording('C', 0.5);
    recording.push([0, 0, 0, 0, 0, 0], 4);
    expect(recording.duration).toBe(1.5);
  });

  it('has nothing before the first push', () => {
    const recording = new Recording('C', 1);
    expect(recording.duration).toBe(0);
    expect(recording.samples().length).toBe(0);
  });
});

describe('RecordingList', () => {
  it('keeps the newest recordings first and drops the oldest past the limit', () => {
    const list = new RecordingList(3, 60);
    const takes = ['A', 'B', 'C', 'D'].map((key) => list.start(key));
    expect(list.all.map((r) => r.keyName)).toEqual(['D', 'C', 'B']);
    expect(list.all[0]).toBe(takes[3]);
  });
});

describe('RecordingList.restore', () => {
  it('merges stored recordings with ones started meanwhile, newest first', () => {
    const list = new RecordingList(3, 60);
    list.start('NEW', new Date(5000));
    const stored = [3000, 2000, 1000].map((t) => new Recording('OLD', 60, new Date(t)));
    list.restore(stored);
    expect(list.all.map((r) => r.startedAt.getTime())).toEqual([5000, 3000, 2000]);
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and the samples', () => {
    const samples = Int16Array.from([0, 1, -1, 2].map(toPcm16));
    const wav = encodeWav(samples, 48000);
    const view = new DataView(wav.buffer);
    const text = (at: number, length: number) => String.fromCharCode(...wav.slice(at, at + length));
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 8)).toBe('WAVEfmt ');
    expect(text(36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(8);
    expect(wav.length).toBe(52);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});
