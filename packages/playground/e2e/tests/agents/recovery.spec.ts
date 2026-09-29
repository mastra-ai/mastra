import { expect, test } from '@playwright/test';

// A missing agent must not strand users in a dead chat. Recovery either reloads
// the resource from the server or returns to the registered agents list.
const agentDetails = /\/api\/agents\/weather-agent(?:\?.*)?$/;

test.describe('Missing agent recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(agentDetails, route =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Agent not found' }),
      }),
    );
    await page.goto('/agents/weather-agent/threads/new');
    await expect(page.getByRole('heading', { name: 'Agent not found' })).toBeVisible();
  });

  test.describe('when the agent is no longer registered', () => {
    test('returns to the agents list instead of allowing a send', async ({ page }) => {
      await expect(page.getByPlaceholder('Enter your message...')).toHaveCount(0);
      await page.getByRole('link', { name: 'Choose agent' }).click();
      await expect(page).toHaveURL(/\/agents$/);
      await expect(page.getByRole('heading', { name: 'Agents', exact: true })).toBeVisible();
    });
  });

  test.describe('when the agent becomes available again', () => {
    test('reloads the resource and restores the chat', async ({ page }) => {
      await page.unroute(agentDetails);
      await page.getByRole('button', { name: 'Reload', exact: true }).click();
      await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Agent not found' })).toHaveCount(0);
    });
  });
});
