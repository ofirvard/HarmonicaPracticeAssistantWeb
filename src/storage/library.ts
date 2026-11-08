import { Recording } from '../core/recordings';

/**
 * Songs and recordings kept in IndexedDB, so they survive a reload. localStorage holds only about
 * 5 MB, less than a minute of audio, so it stays for settings. Song names are unique: importing a
 * file with the same name replaces the song.
 */

export interface Song {
  name: string;
  text: string;
}

interface StoredRecording {
  id: number; // start time in ms, unique per take
  keyName: string;
  sampleRate: number;
  samples: Int16Array;
}

const DB_NAME = 'harmonica';
const DB_VERSION = 1;
const SONGS = 'songs';
const RECORDINGS = 'recordings';

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Resolves once the transaction has committed, so a write is on disk before we say so. */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Saving was cancelled'));
  });
}

export class Library {
  private constructor(
    private readonly db: IDBDatabase,
    private readonly recordingMaxSeconds: number,
  ) {}

  /** Rejects if the browser has no usable IndexedDB, as in some private windows. */
  static async open(recordingMaxSeconds: number, factory: IDBFactory = indexedDB, name = DB_NAME): Promise<Library> {
    const request = factory.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(SONGS, { keyPath: 'name' });
      db.createObjectStore(RECORDINGS, { keyPath: 'id' });
    };
    return new Library(await result(request), recordingMaxSeconds);
  }

  close(): void {
    this.db.close();
  }

  songs(): Promise<Song[]> {
    return result(this.db.transaction(SONGS).objectStore(SONGS).getAll() as IDBRequest<Song[]>);
  }

  async saveSongs(songs: readonly Song[]): Promise<void> {
    const tx = this.db.transaction(SONGS, 'readwrite');
    const store = tx.objectStore(SONGS);
    for (const { name, text } of songs) {
      store.put({ name, text });
    }
    await committed(tx);
  }

  async deleteSong(name: string): Promise<void> {
    const tx = this.db.transaction(SONGS, 'readwrite');
    tx.objectStore(SONGS).delete(name);
    await committed(tx);
  }

  /** Newest first. */
  async recordings(): Promise<Recording[]> {
    const stored = await result(
      this.db.transaction(RECORDINGS).objectStore(RECORDINGS).getAll() as IDBRequest<StoredRecording[]>,
    );
    return stored
      .sort((a, b) => b.id - a.id)
      .map((r) =>
        Recording.restore(r.keyName, this.recordingMaxSeconds, new Date(r.id), r.sampleRate, r.samples),
      );
  }

  /** Saves (or overwrites) one recording and deletes every stored one not in keep. */
  async saveRecording(recording: Recording, keep: readonly Recording[]): Promise<void> {
    const tx = this.db.transaction(RECORDINGS, 'readwrite');
    const store = tx.objectStore(RECORDINGS);
    const stored: StoredRecording = {
      id: recording.startedAt.getTime(),
      keyName: recording.keyName,
      sampleRate: recording.sampleRate,
      samples: recording.samples(),
    };
    store.put(stored);
    const keepIds = new Set(keep.map((r) => r.startedAt.getTime()));
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      for (const id of keys.result) {
        if (!keepIds.has(id as number)) store.delete(id);
      }
    };
    await committed(tx);
  }
}
