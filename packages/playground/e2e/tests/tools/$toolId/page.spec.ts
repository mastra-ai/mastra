import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.describe('Tool detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a tool is executed from its detail page', () => {
    test('returns the tool output for the submitted input', async ({ page }) => {
      await page.goto('/tools?tool=simpleMcpTool');

      await expect(page.getByRole('heading', { name: 'simpleMcpTool' })).toBeVisible();
      await page.getByRole('tab', { name: 'Playground' }).click();
      await expect(page.getByText('No response yet')).toBeVisible();

      await page.getByLabel('The name of the person').fill('John Doe');
      await page.getByRole('button', { name: 'Run' }).click();

      await expect(page.getByText('Success')).toBeVisible();
      await expect(page.locator('pre')).toContainText('"hello": "world"');
      await expect(page.locator('pre')).toContainText('"thisIsA": "fixture"');
    });
  });

  test.describe('when the drawer is closed', () => {
    test('leaves the Tools list', async ({ page }) => {
      await page.goto('/tools?tool=simpleMcpTool');
      await page.getByRole('button', { name: 'Close Panel' }).click();

      await expect(page).toHaveURL(/\/tools$/);
      await expect(page.getByRole('heading', { name: 'simpleMcpTool' })).toBeHidden();
    });
  });
});
