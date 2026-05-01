import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('has breadcrumb navigation', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  await expect(page).toHaveTitle(/Mastra Studio/);

  const breadcrumb = page.locator('nav a:has-text("Scorers")').first();
  await expect(breadcrumb).toHaveAttribute('href', '/scorers');
});

test('displays scorer name and has documentation link', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  await expect(page.locator('h1')).toHaveText('Response Quality Scorer');
  await expect(page.locator('text=Scorers documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/evals/overview',
  );
});

test('hides entity filter dropdown when no filter is applied and there are no scores', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  const entityFilter = page.locator('main').getByRole('combobox').nth(1);
  await expect(entityFilter).toBeHidden();
});

test('shows entity filter dropdown when a filter is applied via URL', async ({ page }) => {
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

  const entityFilter = page.locator('main').getByRole('combobox').nth(1);
  await expect(entityFilter).toBeVisible();
  await expect(entityFilter).toContainText('Weather Agent');
});

test('has scorer combobox for navigation', async ({ page }) => {
  await page.goto('/scorers/response-quality');

  const combobox = page.locator('nav').getByRole('combobox').first();
  await expect(combobox).toBeVisible();
  await expect(combobox).toContainText('Response Quality Scorer');
});
