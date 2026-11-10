import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { storedCount } from './storage';

const SONG = `My Title

4 4 6 6 -6 -6 6
Twin-kle twin-kle lit-tle star
-5 -5 5 5 -4 -4 4
How I won-der what you are
-3' 4 -2 3
bent line here now
`;

const importSong = (page: Page, name: string, text: string) =>
  page.setInputFiles('#import-input', {
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });

const staffText = (page: Page) =>
  page.$$eval('#staff svg text', (texts) => texts.map((t) => t.textContent ?? ''));
const staffLetters = async (page: Page) =>
  (await staffText(page)).filter((s) => /^[A-G]#?\d$/.test(s));
const noteCount = (page: Page) => page.locator('#staff .vf-stavenote').count();

async function loadSong(page: Page) {
  await page.goto('/');
  await importSong(page, 'twinkle.txt', SONG);
  await expect(page.locator('#staff .vf-stavenote')).toHaveCount(18);
}

test('Demo appends and Clear empties the staff', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#staff-hint')).toBeVisible();
  await page.click('#demo-button');
  await expect(page.locator('#staff .vf-stavenote')).toHaveCount(7);
  await expect(page.locator('#staff-hint')).toBeHidden();
  await page.click('#clear-button');
  expect(await noteCount(page)).toBe(0);
});

test('Export saves the staff as a tab that Import reads back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#export-button')).toBeDisabled();
  await importSong(page, 'twinkle.txt', SONG);
  await page.click('#demo-button');
  const before = await staffText(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-button')]);
  expect(download.suggestedFilename()).toMatch(/^twinkle-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.txt$/);
  const text = readFileSync(await download.path(), 'utf8');
  expect(text).toContain('4 4 6 6 -6 -6 6\nTwin-kle twin-kle lit-tle star\n');
  expect(text).toContain('4 -4 5 6 5 -4 4\n'); // the Demo
  await page.click('#clear-button');
  await expect(page.locator('#export-button')).toBeDisabled();
  await importSong(page, 'exported.txt', text);
  await expect(page.locator('#staff .vf-stavenote')).toHaveCount(25);
  expect(await staffText(page)).toEqual(before);
});

test('Import draws notes, bends and hyphenated lyrics', async ({ page }) => {
  await loadSong(page);
  const text = await staffText(page);
  expect(text).toContain("-3'");
  expect(text).toContain('Twin-');
  expect(text).toContain('-kle');
});

test('changing key re-pitches a loaded song', async ({ page }) => {
  await loadSong(page);
  await page.click('[popovertarget=settings]');
  await page.selectOption('#key-select', 'G');
  expect(await staffLetters(page)).toEqual(
    'G4 G4 D5 D5 E5 E5 D5 C5 C5 B4 B4 A4 A4 G4 F4 G4 D4 D4'.split(' '),
  );
});

test('toggles hide holes and letters but never lyrics', async ({ page }) => {
  await loadSong(page);
  await page.click('#holes-toggle');
  expect(await staffText(page)).not.toContain("-3'");
  await page.click('#letters-toggle');
  const text = await staffText(page);
  expect(text).not.toContain('C5');
  expect(text).toContain('Twin-');
});

test('settings persist across a reload and Default resets them', async ({ page }) => {
  await page.goto('/');
  await page.click('[popovertarget=settings]');
  await page.selectOption('#key-select', 'G');
  await page.locator('#spacing-input').fill('140');
  await page.reload();
  await page.click('[popovertarget=settings]');
  await expect(page.locator('#key-select')).toHaveValue('G');
  await expect(page.locator('#spacing-input')).toHaveValue('140');
  await page.click('#settings-default');
  await expect(page.locator('#key-select')).toHaveValue('C');
  await expect(page.locator('#spacing-input')).toHaveValue('80');
});

test('imported songs survive a reload and can be deleted', async ({ page }) => {
  await loadSong(page);
  await importSong(page, 'second.txt', '4 5 6\n');
  await expect.poll(() => storedCount(page, 'songs')).toBe(2);
  await page.reload();
  await expect(page.locator('.song')).toHaveText(['second.txt', 'twinkle.txt']);

  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('#song-list li', { hasText: 'twinkle.txt' }).hover();
  await page.click('[aria-label="Delete twinkle.txt"]');
  await expect(page.locator('.song')).toHaveText(['second.txt']);
  await expect.poll(() => storedCount(page, 'songs')).toBe(1);
  await page.reload();
  await expect(page.locator('.song')).toHaveText(['second.txt']);
});

test('Settings shows the version from package.json', async ({ page }) => {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  await page.goto('/');
  await page.click('[popovertarget=settings]');
  await expect(page.locator('#app-version')).toHaveText(`v${version}`);
});

test('a file with no holes shows an error that Clear dismisses', async ({ page }) => {
  await page.goto('/');
  await importSong(page, 'words.txt', 'just some words\n');
  await expect(page.locator('#status')).toContainText('No hole numbers');
  await page.click('#clear-button');
  await expect(page.locator('#status')).toBeHidden();
});

test('a narrower window wraps the staff without a page scrollbar', async ({ page }) => {
  await loadSong(page);
  const staves = page.locator('#staff .vf-stave');
  const before = await staves.count();
  await page.setViewportSize({ width: 620, height: 620 });
  await expect.poll(() => staves.count()).toBeGreaterThan(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the sidebar can be dragged wider', async ({ page }) => {
  await page.goto('/');
  const box = (await page.locator('#splitter').boundingBox())!;
  await page.mouse.move(box.x + 3, 300);
  await page.mouse.down();
  await page.mouse.move(340, 300);
  await page.mouse.up();
  const width = await page.$eval('#sidebar', (e) => e.getBoundingClientRect().width);
  expect(Math.abs(width - 340)).toBeLessThan(3);
});

test.describe('notes far from the staff', () => {
  // On an F# harp, hole 10 blow is F#7, the highest note any supported key can play.
  const EXTREMES = '10 -10 9\nhigh high high\n1 -1 2\nlow low low\n10 1 10\nup down up\n';

  async function loadExtremes(page: Page) {
    await page.goto('/');
    await page.click('[popovertarget=settings]');
    await page.selectOption('#key-select', 'F#');
    await page.keyboard.press('Escape');
    await importSong(page, 'extremes.txt', EXTREMES);
    await expect(page.locator('#staff .vf-stavenote')).toHaveCount(9);
  }

  test('stay inside the drawing, labels included', async ({ page }) => {
    await loadExtremes(page);
    const overflow = await page.$eval('#staff svg', (svg) => {
      const frame = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('.vf-stavenote, text')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.top < frame.top || r.bottom > frame.bottom || r.right > frame.right)
        .length;
    });
    expect(overflow).toBe(0);
  });

  test('do not collide with the neighbouring lines', async ({ page }) => {
    await loadExtremes(page);
    const lines = await page.$$eval('#staff .vf-staff-line', (groups) =>
      groups.map((g) => {
        const { top, bottom } = g.getBoundingClientRect();
        return { top, bottom };
      }),
    );
    expect(lines).toHaveLength(3);
    expect(lines[0]!.bottom).toBeLessThanOrEqual(lines[1]!.top);
    expect(lines[1]!.bottom).toBeLessThanOrEqual(lines[2]!.top);
  });
});
