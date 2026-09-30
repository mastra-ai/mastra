import { test, expect } from '@playwright/test';
import { resetStorage } from '../../../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Agent tool detail page', () => {
  test.describe('when the tool form is submitted', () => {
    test('renders the tool name and returns the fixture result', async ({ page }) => {
      await page.goto('/agents/weather-agent/tools/simpleMcpTool');

      await expect(page.locator('h2')).toHaveText('simpleMcpTool');
      await page.getByRole('tab', { name: 'Playground' }).click();
      await expect(page.getByText('No response yet')).toBeVisible();

      await page.getByLabel('The name of the person').fill('John Doe');
      await page.getByRole('button', { name: 'Run' }).click();

      await expect(page.getByText('Success')).toBeVisible();
      await expect(page.locator('pre')).toContainText('"hello": "world"');
      await expect(page.locator('pre')).toContainText('"thisIsA": "fixture"');
    });
  });
});
