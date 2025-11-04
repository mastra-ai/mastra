import { test, expect } from '@playwright/test';

test('has valid links', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows');

  const el = await page.locator('text=complex-workflow');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/workflows/complexWorkflow/graph');
  await expect(page.locator('h2')).toHaveText('complex-workflow');
});

test('clicking on the complex-workflow row redirects', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows');

  const el = await page.locator('tr:has-text("complex-workflow")');
  await el.click();

  await expect(page).toHaveURL('http://localhost:4111/workflows/complexWorkflow/graph');
  await expect(page.locator('h2')).toHaveText('complex-workflow');
});
