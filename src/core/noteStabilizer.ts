import type { DetectedNote } from './pitchDetector';

/**
 * Turns raw per-hop detections into committed notes, so a held note fires once rather than once
 * per hop. A raw FFT peak can be a one-off blip, so a note is only trusted once it appears in two
 * consecutive hops. That check is per note, not per chord, so one note settling a hop later than
 * another doesn't suppress either of them.
 */
export class NoteStabilizer {
  private committedSignature = '';
  private previousNames = new Set<string>();

  /** Returns the newly committed notes, or null if nothing new started sounding on this hop. */
  push(rawNotes: readonly DetectedNote[]): DetectedNote[] | null {
    const notes = rawNotes.filter((n) => this.previousNames.has(n.name));
    this.previousNames = new Set(rawNotes.map((n) => n.name));

    const signature = notes.map((n) => n.name).join('+');
    if (signature === this.committedSignature) {
      return null;
    }
    this.committedSignature = signature;
    return signature === '' ? null : notes;
  }
}
