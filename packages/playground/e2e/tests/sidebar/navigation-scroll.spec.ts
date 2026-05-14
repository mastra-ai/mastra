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

  test('should scroll to reveal all navigation sections when viewport height is small', async ({ page }) => {
    // ARRANGE: Set viewport to desktop width but constrained height
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto('/agents');

    // Wait for sidebar scope to be visible and expanded
    await expect(page.locator('[data-sidebar-state="default"]')).toBeAttached({ timeout: 10000 });

    // Locate nav links by role — these span from top (Agents) to bottom (Settings)
    const sidebar = page.locator('nav[aria-label="Main"]');
    const agentsLink = sidebar.getByRole('link', { name: 'Agents' });
    const settingsLink = sidebar.getByRole('link', { name: 'Settings' });

    // All nav links should exist in DOM
    await expect(agentsLink).toBeAttached();
    await expect(settingsLink).toBeAttached();

    // ACT & ASSERT: Scroll to Settings link at bottom and verify it becomes visible
    await settingsLink.scrollIntoViewIfNeeded();
    await expect(settingsLink).toBeVisible();

    // Scroll back to top and verify Agents is visible
    await agentsLink.scrollIntoViewIfNeeded();
    await expect(agentsLink).toBeVisible();
  });

  test('should allow navigation to bottom section items after scrolling', async ({ page }) => {
    // ARRANGE: Constrained viewport
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto('/agents');
    await expect(page.locator('[data-sidebar-state="default"]')).toBeAttached({ timeout: 10000 });

    // ACT: Scroll to and click Settings link
    const sidebar = page.locator('nav[aria-label="Main"]');
    const settingsLink = sidebar.getByRole('link', { name: 'Settings' });
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
    const sidebar = page.locator('nav[aria-label="Main"]');
    const agentsLink = sidebar.getByRole('link', { name: 'Agents' });
    await agentsLink.scrollIntoViewIfNeeded();
    await agentsLink.click();

    // ASSERT: Navigation works from any scroll position
    await expect(page).toHaveURL(/\/agents/);
  });
});
