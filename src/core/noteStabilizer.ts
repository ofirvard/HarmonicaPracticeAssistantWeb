import type { DetectedNote } from './pitchDetector';

/**
 * Turns raw per-hop detections into committed notes, so a held note fires once rather than once
 * per hop. A raw FFT peak can be a one-off blip, so a note is only trusted once it appears in two
 * consecutive hops. That check is per note, not per chord, so one note settling a hop later than
 * another doesn't suppress either of them.
 */
export class NoteStabilizer {
  private sounding = new Set<string>();
  private previousNames = new Set<string>();

  /** Returns the newly committed notes, or null if nothing new started sounding on this hop. */
  push(rawNotes: readonly DetectedNote[]): DetectedNote[] | null {
    const notes = rawNotes.filter((n) => this.previousNames.has(n.name));
    this.previousNames = new Set(rawNotes.map((n) => n.name));

    // Only a note that wasn't already sounding counts. Without this, the notes of a chord fading
    // unevenly would each be recorded again as if they'd just been played.
    const hasNewNote = notes.some((n) => !this.sounding.has(n.name));
    this.sounding = new Set(notes.map((n) => n.name));
    return hasNewNote ? notes : null;
  }
}
