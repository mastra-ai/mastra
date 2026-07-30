import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb, expectRouteDocsLink } from '../__utils__/route-header';

test.describe('Observability traces page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the observability page is visited', () => {
    test('shows the page header and docs link', async ({ page }) => {
      await page.goto('/observability');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Traces');
      await expectRouteDocsLink(
        page,
        'Traces documentation',
        'https://mastra.ai/en/docs/observability/tracing/overview',
      );
    });

    test('shows the filter dropdown', async ({ page }) => {
      await page.goto('/observability');

      // The unified filter dropdown button should be present
      const filterButton = page.getByRole('button', { name: 'Filter' });
      await expect(filterButton).toBeVisible();
    });

    test('renders the empty state or traces list with the default date preset', async ({ page }) => {
      await page.goto('/observability');

      // We check that the page has loaded and the traces tools are visible
      // The date preset dropdown defaults to "Last 24 hours"
      await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
    });
  });

  test.describe('when a scorer link is followed from a trace', () => {
    test.skip('opens the scorer detail page focused on the selected score', async ({ page }) => {
      await page.goto('/observability');

      const firstTraceRow = page.locator('main li button').first();
      await expect(firstTraceRow).toBeVisible();
      await firstTraceRow.click();

      await expect(page.getByRole('dialog')).toBeVisible();

      const scoringButton = page.getByRole('button', { name: 'Scoring' });
      await expect(scoringButton).toBeVisible();
      await scoringButton.click();

      const firstScoreRow = page.locator('[role="dialog"] li button').first();
      await expect(firstScoreRow).toBeVisible();
      await firstScoreRow.click();

      const scoreDialog = page.getByRole('dialog', { name: 'Scorer Score' });
      await expect(scoreDialog).toBeVisible();

      const scoreId = await scoreDialog.getByText(/^scr_/).first().textContent();
      expect(scoreId).toBeTruthy();

      await scoreDialog.getByRole('link', { name: 'Response Quality Scorer' }).click();

      const escapedScoreId = scoreId!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expectedUrl = new RegExp(`/scorers/response-quality\\?entity=.*&scoreId=${escapedScoreId}`);
      await expect(page).toHaveURL(expectedUrl);
      await expect(page.getByRole('dialog', { name: 'Scorer Score' })).toBeVisible();
      await expect(page.getByText(scoreId!, { exact: true })).toBeVisible();
    });
  });
});
