import { test, expect } from '@playwright/test';

/**
 * FEATURE: shadow-dialog token should not have inset gloss in dark mode
 * USER STORY: As a user in dark mode, I should not see a visible highlight
 *             band on the top edge of dialogs, dropdowns, tooltips, and containers.
 * BEHAVIOR UNDER TEST: The computed box-shadow of an element using shadow-dialog
 *                      should NOT contain 'inset' in dark mode.
 *
 * NOTE: We intentionally verify the token directly via an injected probe element.
 * Earlier revisions of this spec tried to open a real Radix DropdownMenu/Tooltip
 * on /agents, but used selectors (`[data-radix-dropdown-menu-trigger]`,
 * `[data-radix-tooltip-trigger]`) that Radix does not emit — the tests would
 * silently `test.skip` on every run. Since the utility is generated at build
 * time from the Tailwind config, probing the resolved value is the canonical
 * assertion and cannot drift with markup changes in consumers.
 */

test.describe('shadow-dialog token - dark mode styling', () => {
  test('shadow-dialog utility resolves with no inset in dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mastra-theme', 'dark');
    });

    await page.goto('/agents', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveClass(/dark/);

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

  test('shadow-dialog utility resolves with no inset in light mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mastra-theme', 'light');
    });

    await page.goto('/agents', { waitUntil: 'domcontentloaded' });

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
