import { test, expect } from '@playwright/test';

test('has overall information', async ({ page }) => {
  await page.goto('http://localhost:4111/agents');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Agents');
  await expect(page.locator('text=Agents documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/agents/overview',
  );

  const table = page.locator('table');
  const firstRow = table.locator('tr:first-child');
  await expect(firstRow.locator('text=1 tool')).toBeVisible();
  await expect(firstRow.locator('text=0 workflow')).toBeVisible();
  await expect(firstRow.locator('text=0 agent')).toBeVisible();
  await expect(firstRow.locator('text=Weather Agent')).toHaveAttribute('href', '/agents/weatherAgent');
});

test('clicking on the agent row redirects', async ({ page }) => {
  await page.goto('http://localhost:4111/agents');

  const el = await page.locator('tr:has-text("Weather Agent")');
  await el.click();

  await expect(page).toHaveURL(/http:\/\/localhost:4111\/agents\/weatherAgent\/chat.*/);
});
