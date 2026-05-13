import { test, expect } from '@playwright/test';

/**
 * FEATURE: shadow-dialog token should not have inset gloss in dark mode
 * USER STORY: As a user in dark mode, I should not see a visible highlight
 *             band on the top edge of dialogs, dropdowns, tooltips, and containers.
 * BEHAVIOR UNDER TEST: The computed box-shadow of elements using shadow-dialog
 *                      should NOT contain 'inset' in dark mode.
 */

test.describe('shadow-dialog token - dark mode styling', () => {
  test('dropdown content shadow-dialog has no inset in dark mode', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass, 'expected dark mode (no .light on html)').not.toContain('light');

    const trigger = page.locator('[data-radix-dropdown-menu-trigger]').first();
    if ((await trigger.count()) === 0) {
      test.skip(true, 'No dropdown trigger on /agents');
      return;
    }
    await trigger.click();

    const content = page.locator('[data-radix-dropdown-menu-content]');
    await expect(content).toBeVisible({ timeout: 5000 });

    const boxShadow = await content.evaluate(el => window.getComputedStyle(el).boxShadow);
    expect(boxShadow, `dropdown box-shadow should not contain inset (got: ${boxShadow})`).not.toContain('inset');
  });

  test('tooltip shadow-dialog has no inset in dark mode', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const trigger = page.locator('[data-radix-tooltip-trigger], button[aria-describedby]').first();
    if ((await trigger.count()) === 0) {
      test.skip(true, 'No tooltip trigger found');
      return;
    }
    await trigger.hover();

    const content = page.locator('[data-radix-tooltip-content]');
    await expect(content).toBeVisible({ timeout: 5000 });

    const boxShadow = await content.evaluate(el => window.getComputedStyle(el).boxShadow);
    expect(boxShadow, `tooltip box-shadow should not contain inset (got: ${boxShadow})`).not.toContain('inset');
  });

  test('any rendered shadow-dialog element has no inset in dark mode', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Inject a probe element with the utility class to read the resolved shadow
    // even if no dialog/popover is currently open.
    const boxShadow = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'shadow-dialog';
      probe.style.position = 'absolute';
      probe.style.left = '-9999px';
      document.body.appendChild(probe);
      const value = window.getComputedStyle(probe).boxShadow;
      probe.remove();
      return value;
    });

    expect(boxShadow, `shadow-dialog probe should not contain inset (got: ${boxShadow})`).not.toContain('inset');
  });
});
