import { test, expect } from '@playwright/test';

/**
 * FEATURE: Shortcut Hints
 * USER STORY: As a Mac user, I want to find a shortcut on the page by typing it as it reads.
 * BEHAVIOR UNDER TEST: The key symbols are drawn, but the shortcut stays one run of searchable text.
 *   Only a browser can tell: the markup around a symbol decides whether find-in-page crosses it.
 */

test.describe('Sidebar Search - Shortcut Hint', () => {
  test.describe('when the search tooltip is open on a Mac', () => {
    test.use({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    });

    test('should find the whole shortcut on the page', async ({ page }) => {
      await page.goto('/agents');
      await page.getByRole('button', { name: 'Search and navigate' }).hover();

      const shortcut = page.getByRole('tooltip').locator('kbd');
      await expect(shortcut.getByRole('img', { name: 'Command' })).toBeVisible();

      const found = await page.evaluate(() => Reflect.apply(Reflect.get(window, 'find'), window, ['⌘ K']));
      expect(found).toBe(true);
    });
  });
});
