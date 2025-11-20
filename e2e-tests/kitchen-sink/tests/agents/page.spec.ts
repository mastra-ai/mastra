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
  await expect(table).toMatchAriaSnapshot();
});

test('clicking on the agent row redirects', async ({ page }) => {
  await page.goto('http://localhost:4111/agents');

  const el = await page.locator('tr:has-text("Weather Agent")');
  await el.click();

  await expect(page).toHaveURL(/http:\/\/localhost:4111\/agents\/weather-agent\/chat.*/);
});
