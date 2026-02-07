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
    await page.evaluate(() => {
      localStorage.setItem('mastra-agent-resource-weatherAgent', 'custom-resource');
    });
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
