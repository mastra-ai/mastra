import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * FEATURE: Shortcut Hints
 * USER STORY: As a user, I want a shortcut's keys evenly spaced, and to find it on the page by typing it as it reads.
 * BEHAVIOR UNDER TEST: The gap between two keys' ink is the same for a drawn symbol and for a word, and the drawn
 *   symbol leaves the shortcut one run of searchable text. Only a browser has the layout and the fonts to tell.
 */

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const GAP_EM = 0.45;

async function openSearchTooltip(page: Page): Promise<Locator> {
  await page.goto('/agents');
  await page.getByRole('button', { name: 'Search and navigate' }).hover();
  await page.evaluate(() => document.fonts.ready);

  return page.getByRole('tooltip').locator('kbd');
}

/** From the first key's ink to the K's, in em. The font itself says where a character's ink sits. */
async function inkGap(shortcut: Locator): Promise<number> {
  return shortcut.evaluate(element => {
    const style = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('Missing canvas context');
    context.font = `${style.fontWeight} 1000px ${style.fontFamily}`;
    const measure = (text: string) => context.measureText(text);

    const keys = Array.from(element.querySelectorAll<HTMLElement | SVGElement>('svg, span')).filter(
      key => key instanceof SVGElement || (key.childElementCount === 0 && key.getBoundingClientRect().width > 0),
    );
    const [first, second] = keys;
    if (!first || !second) throw new Error('Missing keys');

    const em = parseFloat(style.fontSize);
    const text = first.textContent ?? '';
    const metrics = measure(text);
    const firstInkEnd =
      first.getBoundingClientRect().right / em - (metrics.width - metrics.actualBoundingBoxRight) / 1000;
    const secondInkStart =
      second.getBoundingClientRect().left / em - measure(second.textContent ?? '').actualBoundingBoxLeft / 1000;

    return secondInkStart - firstInkEnd;
  });
}

test.describe('Sidebar Search - Shortcut Hint', () => {
  test.describe('when the search tooltip is open on a Mac', () => {
    test.use({ userAgent: MAC });

    test('should find the whole shortcut on the page', async ({ page }) => {
      const shortcut = await openSearchTooltip(page);
      await expect(shortcut.getByRole('img', { name: 'Command' })).toBeVisible();

      const found = await page.evaluate(() => Reflect.apply(Reflect.get(window, 'find'), window, ['⌘ K']));
      expect(found).toBe(true);
    });

    test('should put the shared gap between the symbol and the letter', async ({ page }) => {
      const shortcut = await openSearchTooltip(page);
      await expect(shortcut).toHaveText('⌘ K');

      expect(Math.abs((await inkGap(shortcut)) - GAP_EM)).toBeLessThan(0.03);
    });
  });

  test.describe('when the search tooltip is open on Windows', () => {
    test.use({ userAgent: WINDOWS });

    test('should put the shared gap between the word and the letter', async ({ page }) => {
      const shortcut = await openSearchTooltip(page);
      await expect(shortcut).toHaveText('Ctrl K');

      expect(Math.abs((await inkGap(shortcut)) - GAP_EM)).toBeLessThan(0.03);
    });
  });
});
