import { describe, expect, it } from 'vitest';
import { RecentAudio, encodeWav } from './recentAudio';

describe('RecentAudio', () => {
  it('keeps everything until the buffer is full', () => {
    const audio = new RecentAudio(1);
    audio.push([0.1, 0.2], 4);
    expect(audio.hasAudio).toBe(true);
    expect([...audio.samples()]).toEqual([0.1, 0.2].map(Math.fround));
    expect(audio.duration).toBe(0.5);
  });

  it('keeps only the most recent samples, oldest first', () => {
    const audio = new RecentAudio(1);
    audio.push([1, 2, 3], 4);
    audio.push([4, 5, 6], 4);
    expect([...audio.samples()]).toEqual([3, 4, 5, 6]);
    expect(audio.duration).toBe(1);
  });

  it('starts over when the sample rate changes', () => {
    const audio = new RecentAudio(1);
    audio.push([1, 2, 3], 4);
    audio.push([7], 2);
    expect([...audio.samples()]).toEqual([7]);
    expect(audio.sampleRate).toBe(2);
  });

  it('has nothing before the first push', () => {
    const audio = new RecentAudio(1);
    expect(audio.hasAudio).toBe(false);
    expect(audio.samples().length).toBe(0);
  });
});

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header and clamped samples', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 48000);
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
