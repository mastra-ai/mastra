import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test.describe('resourceId selection', () => {
  test('selector is visible when memory is enabled', async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');
    const selector = page.locator('[class*="Combobox"]').first();
    await expect(selector).toBeVisible();
  });

  test('selector defaults to agentId', async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');
    await expect(page.locator('text=weatherAgent')).toBeVisible();
  });

  test('resourceId persists in localStorage', async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');

    // Open the ResourceIdSelector popover
    const selectorTrigger = page.locator('[class*="Combobox"]').first();
    await selectorTrigger.click();

    // Type a custom resource value and create it
    const input = page.locator('input[placeholder="Search or create new..."]');
    await input.fill('custom-resource');
    await page.keyboard.press('Enter');

    // Wait for navigation after resource change
    await page.waitForURL(/\/agents\/weatherAgent\/chat\/.*\?new=true/);

    // Reload and verify localStorage persistence
    await page.reload();
    const storedValue = await page.evaluate(() => localStorage.getItem('mastra-agent-resource-weatherAgent'));
    expect(storedValue).toBe('custom-resource');
  });

  test('changing resourceId navigates to new thread', async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');
    const initialUrl = page.url();

    const selector = page.locator('[class*="Combobox"]').first();
    await selector.click();
    await page.keyboard.type('new-resource-id');
    await page.keyboard.press('Enter');

    await page.waitForURL(/\/agents\/weatherAgent\/chat\/.*\?new=true/);
    expect(page.url()).not.toBe(initialUrl);
  });
});
