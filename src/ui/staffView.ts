import { Accidental, Annotation, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { layoutLines, type StaffEntry } from '../core/staff';

export interface StaffOptions {
  spacing: number;
  noteScale: number;
  annotationSize: number;
  showHoles: boolean;
  showLetters: boolean;
}

const BASE_GLYPH_SCALE = 39;
const TEXT_COLOR = '#e8e8e8';
const NOTE_COLOR = '#39ff88';
const PENDING_COLOR = '#5a5a5a';
const LINE_GAP = 20;
const EDGE_PADDING = 10;

/**
 * Draws entries as staff notation with VexFlow. render() rebuilds the whole SVG, so it's O(n) in
 * the number of entries: batch changes into one setEntries call rather than one per note.
 */
export class StaffView {
  private entries: readonly StaffEntry[] = [];
  // In practice mode, entries before this index have been played and the rest are dimmed.
  private practiceIndex: number | null = null;

  constructor(
    private readonly scroller: HTMLElement,
    private readonly container: HTMLElement,
    private options: StaffOptions,
  ) {
    // Observing the element rather than the window also catches the sidebar being dragged.
    let lastWidth = scroller.clientWidth;
    new ResizeObserver(() => {
      if (scroller.clientWidth !== lastWidth) {
        lastWidth = scroller.clientWidth;
        this.render();
      }
    }).observe(scroller);
  }

  setEntries(entries: readonly StaffEntry[], scroll: 'top' | 'bottom' | 'keep'): void {
    this.entries = entries;
    this.render();
    if (scroll === 'top') {
      this.scroller.scrollTop = 0;
    } else if (scroll === 'bottom') {
      this.scroller.scrollTop = this.scroller.scrollHeight;
    }
  }

  setOptions(options: StaffOptions): void {
    this.options = options;
    this.render();
  }

  setPracticeIndex(index: number | null): void {
    this.practiceIndex = index;
    this.render();
  }

  private annotate(note: StaveNote, text: string, justify: number): void {
    const annotation = new Annotation(text)
      .setFont('Arial', this.options.annotationSize)
      .setVerticalJustification(justify);
    annotation.setStyle({ fillStyle: TEXT_COLOR });
    note.addModifier(annotation, 0);
  }

  private buildNote(entry: StaffEntry, index: number): StaveNote {
    const { noteScale, showHoles, showLetters } = this.options;
    const note = new StaveNote({
      keys: entry.keys,
      duration: 'q',
      clef: 'treble',
      glyph_font_scale: BASE_GLYPH_SCALE * noteScale,
    });
    const pending = this.practiceIndex !== null && index >= this.practiceIndex;
    const color = pending ? PENDING_COLOR : NOTE_COLOR;
    note.setStyle({ fillStyle: color, strokeStyle: color });
    note.setLedgerLineStyle({ strokeStyle: TEXT_COLOR });

    entry.keys.forEach((key, i) => {
      if (key.includes('#')) {
        note.addModifier(new Accidental('#'), i);
      }
    });

    const { TOP, BOTTOM } = Annotation.VerticalJustify;
    if (showHoles) {
      this.annotate(note, entry.holes, TOP);
    }
    if (showLetters) {
      this.annotate(note, entry.letters, BOTTOM);
    }
    // Always shown when present, stacking below whichever annotations are visible.
    if (entry.lyric) {
      this.annotate(note, entry.lyric, BOTTOM);
    }
    return note;
  }

  private render(): void {
    const { scroller, container, entries } = this;
    const { spacing } = this.options;
    // Rebuilding empties the scroller for a moment, which would otherwise reset its position.
    const scrollTop = scroller.scrollTop;
    container.innerHTML = '';
    if (entries.length === 0) {
      return;
    }

    const perLine = Math.max(1, Math.floor((scroller.clientWidth - 40) / spacing));
    const renderer = new Renderer(container as HTMLDivElement, Renderer.Backends.SVG);
    renderer.resize(scroller.clientWidth, 1);
    const context = renderer.getContext();
    context.setFillStyle(TEXT_COLOR);
    context.setStrokeStyle(TEXT_COLOR);

    // Each line is drawn at the top, measured, then moved into place. How far a line reaches
    // depends on its pitches, stems, labels and sizes, so only the drawn result can say how much
    // room it needs. A high note can rise far above the stave.
    let index = 0;
    let y = 0;
    let width = 0;
    for (const line of layoutLines(entries, perLine)) {
      const group = context.openGroup('staff-line') as SVGGElement;
      const staveWidth = line.entries.length * spacing + 20;
      const stave = new Stave(10, 0, staveWidth);
      if (line.startsPhrase) {
        stave.addClef('treble');
      }
      stave.setContext(context).draw();

      const notes = line.entries.map((entry) => this.buildNote(entry, index++));
      const voice = new Voice({ num_beats: line.entries.length, beat_value: 4 }).setStrict(false);
      voice.addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], staveWidth - 40);
      voice.draw(context, stave);
      context.closeGroup();

      const box = group.getBBox();
      // The stave's own space above its top line, kept as a minimum so that lines of ordinary
      // notes stay evenly spaced.
      const top = Math.min(box.y, 0);
      group.setAttribute('transform', `translate(0, ${y - top})`);
      y += box.y + box.height - top + LINE_GAP;
      width = Math.max(width, box.x + box.width);
    }
    renderer.resize(Math.ceil(width + EDGE_PADDING), Math.ceil(y));

    scroller.scrollTop = scrollTop;
  }
}
