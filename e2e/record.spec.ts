import { writeFileSync } from 'node:fs';
import { chromium, expect, test, type Page } from '@playwright/test';
import { storedCount } from './storage';
import { renderWav } from './wav';

const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G4 = 392.0;
const G5 = 783.99;

const staffLetters = (page: Page) =>
  page.$$eval('#staff svg text', (texts) =>
    texts.map((t) => t.textContent ?? '').filter((s) => /^[A-G]#?\d(\+[A-G]#?\d)*$/.test(s)),
  );
const staffText = (page: Page) =>
  page.$$eval('#staff svg text', (texts) => texts.map((t) => t.textContent ?? ''));

test.describe('with a fake microphone', () => {
  test('records notes, chords and repeats from real audio', async ({ baseURL }, testInfo) => {
    const gap = { seconds: 0.4, frequencies: [] };
    const wavPath = testInfo.outputPath('harmonica.wav');
    writeFileSync(
      wavPath,
      renderWav([
        { seconds: 1, frequencies: [] },
        { seconds: 0.6, frequencies: [C5] },
        gap,
        { seconds: 0.6, frequencies: [C5] },
        gap,
        { seconds: 0.6, frequencies: [D5] },
        gap,
        { seconds: 0.6, frequencies: [G4] },
        gap,
        { seconds: 0.8, frequencies: [C5, E5, G5] },
        { seconds: 2, frequencies: [] },
      ]),
    );

    const browser = await chromium.launch({
      channel: 'chromium',
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${wavPath}%noloop`,
      ],
    });
    const page = await browser.newPage({ baseURL });
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(e.message));
    await page.addInitScript(() => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (constraints) => {
        (window as any).micConstraints = constraints;
        return real(constraints);
      };
    });

    await page.goto('/');
    await page.click('#record-button');
    await expect(page.locator('#record-button')).toHaveText('Stop');
    await expect(page.locator('#level')).toBeVisible();

    await expect
      .poll(() => staffLetters(page), { timeout: 15000 })
      .toEqual(['C5', 'C5', 'D5', 'G4', 'C5+E5+G5']);
    const text = await staffText(page);
    expect(text).toContain('-4');
    expect(text).toContain('3/-2');
    expect(text).toContain('4+5+6');

    const constraints = await page.evaluate(() => (window as any).micConstraints.audio);
    expect(constraints).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
    await expect(page.locator('#status')).toBeHidden();

    await page.click('#record-button');
    await expect(page.locator('#record-button')).toHaveText('Record');
    await expect(page.locator('#level')).toBeHidden();

    // The take is kept across a reload, ready to save as a WAV.
    await expect.poll(() => storedCount(page, 'recordings')).toBe(1);
    await page.reload();
    await page.click('[popovertarget=settings]');
    await expect(page.locator('#recording-list li')).toHaveCount(1);
    await expect(page.locator('#recording-list li')).toContainText('C harp');
    expect(problems).toEqual([]);
    await browser.close();
  });
});

test.describe('microphone failures', () => {
  async function failWith(page: Page, name: string) {
    await page.addInitScript((errorName) => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('fake', errorName));
    }, name);
    await page.goto('/');
    await page.click('#record-button');
  }

  for (const [name, message] of [
    ['NotAllowedError', 'Microphone access is blocked'],
    ['NotFoundError', 'No microphone was found'],
    ['NotReadableError', 'Another app may be using it'],
  ] as const) {
    test(`explains ${name} and stays usable`, async ({ page }) => {
      await failWith(page, name);
      await expect(page.locator('#status')).toContainText(message);
      await expect(page.locator('#record-button')).toHaveText('Record');
      await expect(page.locator('#record-button')).toBeEnabled();
    });
  }

  test('resets when the microphone disconnects mid-recording', async ({ page }) => {
    await page.addInitScript(() => {
      const context = new AudioContext();
      const fakeStream = context.createMediaStreamDestination().stream;
      navigator.mediaDevices.getUserMedia = async () => {
        (window as any).micTrack = fakeStream.getAudioTracks()[0];
        return fakeStream;
      };
    });
    await page.goto('/');
    await page.click('#record-button');
    await expect(page.locator('#record-button')).toHaveText('Stop');

    await page.evaluate(() => (window as any).micTrack.dispatchEvent(new Event('ended')));
    await expect(page.locator('#status')).toContainText('disconnected');
    await expect(page.locator('#record-button')).toHaveText('Record');
    await expect(page.locator('#level')).toBeHidden();
  });
});
