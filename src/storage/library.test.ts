import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { Recording, RecordingList } from '../core/recordings';
import { Library } from './library';

const open = (factory: IDBFactory) => Library.open(60, factory);

describe('Library', () => {
  it('keeps songs across a reopen, replacing one with the same name', async () => {
    const factory = new IDBFactory();
    const library = await open(factory);
    await library.saveSongs([{ name: 'a.txt', text: '4 5' }, { name: 'b.txt', text: '6' }]);
    await library.saveSongs([{ name: 'a.txt', text: '-4' }]);
    library.close();

    const reopened = await open(factory);
    const songs = await reopened.songs();
    expect(songs.sort((x, y) => x.name.localeCompare(y.name))).toEqual([
      { name: 'a.txt', text: '-4' },
      { name: 'b.txt', text: '6' },
    ]);
  });

  it('deletes a song', async () => {
    const library = await open(new IDBFactory());
    await library.saveSongs([{ name: 'a.txt', text: '4' }]);
    await library.deleteSong('a.txt');
    expect(await library.songs()).toEqual([]);
  });

  it('keeps recordings across a reopen, newest first, with their audio', async () => {
    const factory = new IDBFactory();
    const library = await open(factory);
    const older = new Recording('C', 60, new Date(1000));
    older.push([0.5, -0.5], 4);
    const newer = new Recording('G', 60, new Date(2000));
    newer.push([0.25], 4);
    await library.saveRecording(older, [older]);
    await library.saveRecording(newer, [newer, older]);
    library.close();

    const restored = await (await open(factory)).recordings();
    expect(restored.map((r) => [r.keyName, r.startedAt.getTime(), r.sampleRate])).toEqual([
      ['G', 2000, 4],
      ['C', 1000, 4],
    ]);
    expect([...restored[1]!.samples()]).toEqual([...older.samples()]);
  });

  it('overwrites a recording saved again and drops ones no longer kept', async () => {
    const library = await open(new IDBFactory());
    const list = new RecordingList(2, 60);
    const takes = [1000, 2000, 3000].map((t) => list.start('C', new Date(t)));
    for (const take of takes) {
      take.push([0.1], 4);
      await library.saveRecording(take, list.all);
    }
    takes[2]!.push([0.2], 4);
    await library.saveRecording(takes[2]!, list.all);

    const stored = await library.recordings();
    expect(stored.map((r) => r.startedAt.getTime())).toEqual([3000, 2000]);
    expect(stored[0]!.duration).toBe(0.5);
  });
});
