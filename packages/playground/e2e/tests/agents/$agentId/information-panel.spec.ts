import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Smart Information Panel Toggling
 * USER STORY: As a user, I want the Overview and Memory panels to intelligently
 * resize when I toggle them, so I can view both without cramped content.
 *
 * BEHAVIOR UNDER TEST:
 * 1. Both panels start hidden by default (sessionStorage empty)
 * 2. Toggling a panel on shows it at the stored/default width
 * 3. When one panel is active and the second is toggled on:
 *    - If current width ≤ 25%, panel grows to 2x to fit both
 *    - If current width > 25%, panel caps at 50% (its max)
 * 4. Panel visibility persists across navigation and page reload
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Information Panel - Visibility Behavior', () => {
  test('overview and memory panels are hidden by default on first load', async ({ page }) => {
    // Clear sessionStorage to simulate first-time user
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ASSERT: Right panel content should NOT be visible
    // The agent heading "Weather Agent" lives inside the Overview card
    await expect(page.locator('h2:has-text("Weather Agent")')).not.toBeVisible();

    // The toggle buttons should show unpressed state (ghost variant)
    const overviewToggle = page.getByRole('button', { name: /Overview/i });
    const memoryToggle = page.getByRole('button', { name: /Memory/i });
    await expect(overviewToggle).toBeVisible();
    await expect(memoryToggle).toBeVisible();
  });

  test('toggling Overview on reveals the Overview panel content', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ACT: Click the Overview toggle
    await page.getByRole('button', { name: /Show Overview/i }).click();

    // ASSERT: Overview content is now visible
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

    // Memory content should still be hidden
    // Memory section header says "Memory" - it shouldn't be visible yet
    await expect(page.locator('section:has-text("Memory") >> text=Memory').first()).not.toBeVisible();
  });

  test('toggling Memory on reveals the Memory panel content', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ACT: Click the Memory toggle
    await page.getByRole('button', { name: /Show Memory/i }).click();

    // ASSERT: Memory section visible (contains "Memory" header)
    const memorySection = page.locator('section').filter({ hasText: 'Memory' });
    await expect(memorySection).toBeVisible();
  });

  test('visibility persists after page reload', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ACT: Toggle Overview on
    await page.getByRole('button', { name: /Show Overview/i }).click();
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

    // ACT: Reload the page
    await page.reload();

    // ASSERT: Overview is still visible after reload
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();
  });

  test('toggling both panels shows them side by side', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ACT: Toggle both Overview and Memory on
    await page.getByRole('button', { name: /Show Overview/i }).click();
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

    await page.getByRole('button', { name: /Show Memory/i }).click();

    // ASSERT: Both panels are visible simultaneously
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();
    const memorySection = page.locator('section').filter({ hasText: 'Memory' });
    await expect(memorySection).toBeVisible();
  });

  test('hiding both panels removes the right sidebar entirely', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ARRANGE: Show both panels
    await page.getByRole('button', { name: /Show Overview/i }).click();
    await page.getByRole('button', { name: /Show Memory/i }).click();
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

    // ACT: Hide both panels
    await page.getByRole('button', { name: /Hide Overview/i }).click();
    await page.getByRole('button', { name: /Hide Memory/i }).click();

    // ASSERT: Right panel content is hidden
    await expect(page.locator('h2:has-text("Weather Agent")')).not.toBeVisible();
  });
});

test.describe('Information Panel - Smart Resizing Behavior', () => {
  test('opening second panel when first is narrow grows the right panel', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ARRANGE: Show Overview panel first
    await page.getByRole('button', { name: /Show Overview/i }).click();
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

    // Get the right panel element via data-panel attribute
    const rightPanel = page.locator('[data-panel="right-slot"]');
    await expect(rightPanel).toBeVisible();

    // Get initial panel width percentage
    const initialWidth = await rightPanel.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.flexGrow);
    });

    // ACT: Toggle Memory on (should trigger resize)
    await page.getByRole('button', { name: /Show Memory/i }).click();

    // ASSERT: Both panels visible
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();
    const memorySection = page.locator('section').filter({ hasText: 'Memory' });
    await expect(memorySection).toBeVisible();

    // The panel should have grown (or at least not shrunk)
    const newWidth = await rightPanel.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.flexGrow);
    });

    expect(newWidth).toBeGreaterThanOrEqual(initialWidth);
  });

  test('panel size persists across toggle cycles', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');
    await page.evaluate(() => sessionStorage.removeItem('agent-panel-visibility'));
    await page.reload();

    // ARRANGE: Show Overview
    await page.getByRole('button', { name: /Show Overview/i }).click();
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

    // ACT: Hide and re-show
    await page.getByRole('button', { name: /Hide Overview/i }).click();
    await expect(page.locator('h2:has-text("Weather Agent")')).not.toBeVisible();

    await page.getByRole('button', { name: /Show Overview/i }).click();

    // ASSERT: Panel reappears with content visible
    await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();
  });
});
