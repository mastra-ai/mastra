import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('/login does not crash and stays mounted (auth disabled in smoke fixture)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    // Auth is disabled — the route may render an empty layout or redirect to
    // a default route. In both cases the document must mount without errors.
    await expect(page.locator('body')).toBeAttached();

    // The Mastra Studio shell loads the root div even when /login is empty.
    await expect(page.locator('#root, body > div').first()).toBeAttached();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
