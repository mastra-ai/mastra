import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has overall information', async ({ page }) => {
  await page.goto('/observability');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1').first()).toHaveText('Traces');
  await expect(page.getByRole('link', { name: 'Traces documentation' })).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/observability/tracing/overview',
  );
});

test('has filter dropdown', async ({ page }) => {
  await page.goto('/observability');

  // The unified filter dropdown button should be present
  const filterButton = page.getByRole('button', { name: 'Filter' });
  await expect(filterButton).toBeVisible();
});

test('renders empty state or traces list', async ({ page }) => {
  await page.goto('/observability');

  // We check that the page has loaded and the traces tools are visible
  // The date preset dropdown defaults to "Last 24 hours"
  await expect(page.getByRole('button', { name: 'Last 24 hours' })).toBeVisible();
});

test.skip('scorer links from observability open the scorer detail page focused on the selected score', async ({
  page,
}) => {
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

  const expectedUrl = new RegExp(`/scorers/response-quality\\?entity=.*&scoreId=${scoreId}`);
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.getByRole('dialog', { name: 'Scorer Score' })).toBeVisible();
  await expect(page.getByText(scoreId!, { exact: true })).toBeVisible();
});
