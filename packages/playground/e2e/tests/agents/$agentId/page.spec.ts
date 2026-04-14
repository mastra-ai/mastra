import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage().catch(() => {});
});

/**
 * FEATURE: Agent chat layout controls
 * USER STORY: As a user, I can access runtime settings from chat composer,
 *             keep thread actions and memory tools in the left sidebar, and open
 *             the compact agent overview panel only when needed.
 * BEHAVIOR UNDER TEST: Memory configuration and enabled memory capabilities are
 *                      available from the sidebar without opening a modal.
 */

test('chat layout exposes relocated controls and actions', async ({ page }) => {
  // Clear localStorage so panel layout starts fresh (right sidebar collapsed)
  await page.goto('/agents/weather-agent/chat/1234');
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('agent-layout-')) localStorage.removeItem(key);
    }
  });
  await page.reload();

  await expect(page).toHaveTitle(/Mastra Studio/);

  // Left sidebar icon tabs visible (conversations + memory)
  await expect(page.getByTestId('left-sidebar-tabs')).toBeVisible();
  await expect(page.getByTestId('left-tab-conversations')).toBeVisible();
  await expect(page.getByTestId('left-tab-memory')).toBeVisible();
  // Right sidebar toggle visible
  await expect(page.getByTestId('toggle-right-sidebar')).toBeVisible();

  await expect(page.getByRole('link', { name: /New Chat/i })).toBeVisible();

  // Switch to Memory tab via icon and verify configuration section
  await page.getByTestId('left-tab-memory').click();
  await expect(page.getByRole('heading', { name: 'Memory Configuration' })).toBeVisible();

  // Chat Settings modal accessible from composer area
  await page.getByTestId('chat-settings-button').click();
  await expect(page.getByRole('heading', { name: 'Chat Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Model Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tracing Options' })).toBeVisible();
});
