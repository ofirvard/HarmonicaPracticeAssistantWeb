import type { FrequencyRange } from '../core/harmonica';
import { HOP_SIZE, NoteReader } from '../core/noteReader';
import { NoteStabilizer } from '../core/noteStabilizer';
import type { DetectedNote } from '../core/pitchDetector';
import { openMic, type MicSession } from './mic';

export interface ListenerCallbacks {
  onNotes(notes: DetectedNote[]): void; // each time a new note or chord starts sounding
  onLevel(rms: number): void; // once per hop
  onFailure(message: string): void; // listening died after it started
  onAudio?(samples: Float32Array, sampleRate: number): void; // raw audio, once per hop
  range?(): FrequencyRange; // the selected harp's notes; anything outside is never reported
}

/** Listens on the microphone until the returned session is closed. Rejects with a MicError. */
export async function startListening(callbacks: ListenerCallbacks): Promise<MicSession> {
  let reader: NoteReader | null = null;
  const stabilizer = new NoteStabilizer();

  const session: MicSession = await openMic(HOP_SIZE, {
    onHop(samples, sampleRate) {
      try {
        callbacks.onAudio?.(samples, sampleRate);
        reader ??= new NoteReader(sampleRate);
        reader.setRange(callbacks.range?.() ?? null);
        const notes = stabilizer.push(reader.push(samples));
        callbacks.onLevel(reader.lastRms);
        if (notes) {
          callbacks.onNotes(notes);
        }
      } catch (e) {
        // Otherwise the button would keep saying Stop with no notes ever arriving.
        session.close();
        callbacks.onFailure(`Audio capture stopped unexpectedly: ${e instanceof Error ? e.message : e}`);
      }
    },
    onFailure: callbacks.onFailure,
  });
  return session;
}
