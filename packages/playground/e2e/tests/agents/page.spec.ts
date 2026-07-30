import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb, expectRouteDocsLink } from '../__utils__/route-header';

test.describe('Agents list page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the agents page is visited', () => {
    test('shows the page header, docs link, and renders the agent list', async ({ page }) => {
      await page.goto('/agents');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Agents');
      await expectRouteDocsLink(page, 'Agents documentation', 'https://mastra.ai/en/docs/agents/overview');

      // Verify agent list renders with at least one agent
      await expect(page.locator('.data-list-row').first()).toBeVisible();
    });
  });

  test.describe('when an agent row is clicked', () => {
    test('navigates to that agent chat page', async ({ page }) => {
      await page.goto('/agents');

      const el = page.locator('a:has-text("Weather Agent")');
      await el.click();

      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat.*/);
    });
  });
});
