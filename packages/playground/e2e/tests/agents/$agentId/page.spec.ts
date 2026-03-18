import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

/**
 * FEATURE: Agent chat layout controls
 * USER STORY: As a user, I can access runtime settings from chat composer,
 *             keep thread actions in the left sidebar, and open the compact
 *             agent overview panel only when needed.
 */

test('chat layout exposes relocated controls and actions', async ({ page }) => {
  await page.goto('/agents/weather-agent/chat/1234');

  await expect(page).toHaveTitle(/Mastra Studio/);

  // Right panel starts collapsed and uses Agent Overview affordance
  const overviewTrigger = page.getByRole('button', { name: /Agent Overview/i });
  await expect(overviewTrigger).toBeVisible();

  // Top tab bar has icon-only actions (copy/share always present)
  await expect(page.getByTestId('agent-tab-actions')).toBeVisible();
  await expect(page.getByTestId('agent-tab-actions').getByRole('button', { name: /Copy Agent ID/i })).toBeVisible();
  await expect(page.getByTestId('agent-tab-actions').getByRole('button', { name: /Copy session URL/i })).toBeVisible();

  // Left sidebar contains thread list, memory entry point, and per-thread actions
  await expect(page.getByRole('link', { name: /New Chat/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Memory' })).toBeVisible();
  await page.getByTestId('thread-list').getByRole('link').nth(1).hover();
  await expect(page.getByRole('button', { name: /clone thread/i }).first()).toBeVisible();

  // Settings moved to composer dialog
  await page.getByTestId('chat-settings-button').click();
  await expect(page.getByRole('heading', { name: 'Chat Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Model Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Tracing Options' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Request Context' })).toBeVisible();
});
