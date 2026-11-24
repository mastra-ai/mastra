import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Sidebar Navigation Scroll
 * USER STORY: As a user with a small viewport height, I want to scroll through all
 *   navigation items so that I can access any section without resizing my window.
 * BEHAVIOR UNDER TEST: All nav sections remain accessible via scroll when viewport
 *   height is constrained.
 */

test.describe('Sidebar Navigation - Scroll Behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the viewport height is constrained', () => {
    test('should allow navigation to bottom section items after scrolling', async ({ page }) => {
      // ARRANGE: Constrained viewport
      await page.setViewportSize({ width: 1280, height: 400 });
      await page.goto('/agents');
      await expect(page.locator('[data-sidebar-state="default"]')).toBeAttached({ timeout: 10000 });

      // ACT: Scroll to and click Settings link
      const sidebar = page.locator('[data-sidebar-state="default"]');
      const settingsLink = sidebar.getByRole('link', { name: 'Settings', exact: true });
      await settingsLink.scrollIntoViewIfNeeded();
      await settingsLink.click();

      // ASSERT: Navigation succeeded - URL changed and settings page loaded
      await expect(page).toHaveURL(/\/settings/);
    });

    test('should allow navigation from bottom to top sections after scrolling', async ({ page }) => {
      // ARRANGE: Constrained viewport, start at settings
      await page.setViewportSize({ width: 1280, height: 400 });
      await page.goto('/settings');
      await expect(page.locator('[data-sidebar-state="default"]')).toBeAttached({ timeout: 10000 });

      // ACT: Scroll to Agents link (top of nav) and click
      const sidebar = page.locator('[data-sidebar-state="default"]');
      const agentsLink = sidebar.getByRole('link', { name: 'Agents', exact: true });
      await agentsLink.scrollIntoViewIfNeeded();
      await agentsLink.click();

      // ASSERT: Navigation works from any scroll position
      await expect(page).toHaveURL(/\/agents/);
    });
  });
});
