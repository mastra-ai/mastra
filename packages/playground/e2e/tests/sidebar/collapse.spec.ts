import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Sidebar collapse
 * USER STORY: As a user, I want to collapse the sidebar to its icon rail and have Studio remember it, so that I keep
 *   the extra room across reloads and can still reach every page from the rail.
 * BEHAVIOR UNDER TEST: Collapsing animates first and switches to the rail only once the width settles, so the saved
 *   state must follow where the sidebar is going, including when a second toggle turns a collapse around mid-way.
 *   The suite's config prefers reduced motion (an instant collapse); these cases turn the animation back on.
 */

const sidebarScope = (page: Page) => page.locator('[data-sidebar-scope]');

async function openAgents(page: Page) {
  await page.goto('/agents');
  await expect(sidebarScope(page)).toHaveAttribute('data-sidebar-state', 'default', { timeout: 10000 });
}

test.describe('Sidebar collapse', () => {
  test.use({ reducedMotion: 'no-preference' });

  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the sidebar is collapsed with its toggle', () => {
    test('stays collapsed after a reload', async ({ page }) => {
      await openAgents(page);

      await page.getByRole('button', { name: 'Toggle sidebar' }).click();
      await expect(sidebarScope(page)).toHaveAttribute('data-sidebar-state', 'collapsed');

      await page.reload();
      await expect(sidebarScope(page)).toHaveAttribute('data-sidebar-state', 'collapsed', { timeout: 10000 });
    });

    test('still opens pages from the rail', async ({ page }) => {
      await openAgents(page);

      await page.getByRole('button', { name: 'Toggle sidebar' }).click();
      await expect(sidebarScope(page)).toHaveAttribute('data-sidebar-state', 'collapsed');

      await page.locator('.sidebar-layout nav').getByRole('link', { name: 'Workflows', exact: true }).click();
      await expect(page).toHaveURL(/\/workflows$/);
    });
  });

  test.describe('when the toggle is pressed again while the sidebar is still collapsing', () => {
    test('stays expanded after a reload', async ({ page }) => {
      await openAgents(page);

      // Both clicks inside the page, one frame apart: the scope is read while the 200ms collapse is running, and the
      // second click lands in it. Had it been ignored, the collapse would finish and the sidebar would end up
      // collapsed.
      const motionBetweenClicks = await page.evaluate(async () => {
        const toggle = document.querySelector<HTMLButtonElement>('[aria-label="Toggle sidebar"]');
        toggle?.click();
        await new Promise(resolve => requestAnimationFrame(resolve));
        const motion = document.querySelector('.sidebar-layout')?.getAttribute('data-sidebar-motion');
        toggle?.click();
        return motion;
      });
      expect(motionBetweenClicks).toBe('collapsing');
      await page.waitForTimeout(500);
      await expect(page.locator('.sidebar-layout')).not.toHaveAttribute('data-sidebar-motion', /.+/);
      await expect(sidebarScope(page)).toHaveAttribute('data-sidebar-state', 'default');

      await page.reload();
      await expect(sidebarScope(page)).toHaveAttribute('data-sidebar-state', 'default', { timeout: 10000 });
    });
  });
});
