import type { Page } from '@playwright/test';

/** How many entries the app has committed to an IndexedDB store, so a reload can't race the write. */
export const storedCount = (page: Page, store: 'songs' | 'recordings') =>
  page.evaluate(
    (name) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('harmonica');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction(name).objectStore(name).count();
          count.onsuccess = () => {
            open.result.close();
            resolve(count.result);
          };
        };
      }),
    store,
  );
