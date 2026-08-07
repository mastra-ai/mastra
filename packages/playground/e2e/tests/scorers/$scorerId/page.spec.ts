import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectBreadcrumbLink, expectCurrentBreadcrumb, expectRouteDocsLink } from '../../__utils__/route-header';

test.describe('Scorer detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a scorer detail page is visited', () => {
    test('has breadcrumb navigation back to the scorers list', async ({ page }) => {
      await page.goto('/scorers/response-quality');

      await expect(page).toHaveTitle(/Mastra Studio/);

      await expectBreadcrumbLink(page, 'Scorers', '/scorers');
    });

    test('displays the scorer name and a documentation link', async ({ page }) => {
      await page.goto('/scorers/response-quality');

      await expectCurrentBreadcrumb(page, 'Response Quality Scorer');
      await expectRouteDocsLink(page, 'Scorers documentation', 'https://mastra.ai/en/docs/evals/overview');
    });

    test('has a scorer combobox for navigation', async ({ page }) => {
      await page.goto('/scorers/response-quality');

      const combobox = page.locator('nav').getByRole('combobox').first();
      await expect(combobox).toBeVisible();
      await expect(combobox).toContainText('Response Quality Scorer');
    });
  });

  test.describe('when no entity filter is applied and there are no scores', () => {
    test('hides the entity filter dropdown', async ({ page }) => {
      await page.goto('/scorers/response-quality');

      await expect(page.locator('main').getByRole('combobox')).toHaveCount(0);
    });
  });

  test.describe('when an entity filter is applied via URL', () => {
    test('shows the entity filter dropdown with the linked entity', async ({ page }) => {
      // Stub the scorer response so the scorer reports weather-agent as a linked entity;
      // the kitchen-sink scorer fixture is not wired to any agent by default.
      await page.route('**/scores/scorers/response-quality', async route => {
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({
          response,
          json: { ...body, agentIds: ['weather-agent'], agentNames: ['Weather Agent'] },
        });
      });

      await page.goto('/scorers/response-quality?entity=weather-agent');

      const entityFilter = page.locator('main').getByRole('combobox').first();
      await expect(entityFilter).toBeVisible();
      await expect(entityFilter).toContainText('Weather Agent');
    });
  });
});
