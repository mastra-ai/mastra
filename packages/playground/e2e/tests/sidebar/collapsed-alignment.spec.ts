import type { Locator } from '@playwright/test';
import { test, expect } from '@playwright/test';

/**
 * FEATURE: Collapsed sidebar
 * USER STORY: As a user with the sidebar collapsed, I want every icon centered in its row so that the rail reads as
 *   one column.
 * BEHAVIOR UNDER TEST: Icons sit on the center of their rows at the real icon size and rail width, and collapsing
 *   doesn't move them sideways.
 */

const iconCenters = (rows: Locator) =>
  rows.evaluateAll(links =>
    links.map(link => {
      const icon = link.querySelector('svg')?.getBoundingClientRect();
      const row = link.getBoundingClientRect();
      return {
        name: link.textContent,
        icon: icon ? icon.x + icon.width / 2 : undefined,
        row: row.x + row.width / 2,
      };
    }),
  );

test.describe('Sidebar - Collapsed Alignment', () => {
  test.describe('when the sidebar is collapsed', () => {
    test('centers every icon in its row without moving it', async ({ page }) => {
      await page.goto('/agents');
      const rows = page.locator('[data-slot="sidebar-nav"] a');
      await expect(rows.first()).toBeVisible({ timeout: 10000 });
      const expanded = await iconCenters(rows);

      await page.getByRole('button', { name: 'Toggle sidebar' }).click();
      await expect(page.locator('[data-sidebar-state="collapsed"]')).toBeAttached();
      await expect.poll(async () => (await page.locator('.sidebar-layout').first().boundingBox())?.width).toBe(60);

      const collapsed = await iconCenters(rows);
      expect(collapsed.length).toBeGreaterThan(1);
      expect(collapsed.map(({ name, icon }) => ({ name, icon }))).toEqual(
        collapsed.map(({ name, row }) => ({ name, icon: row })),
      );
      // Distinct positions, not one per row: rows are still being added while the page loads.
      expect(new Set(collapsed.map(({ icon }) => icon))).toEqual(new Set(expanded.map(({ icon }) => icon)));
    });
  });
});
