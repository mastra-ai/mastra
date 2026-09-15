import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.describe('Tool detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a tool is executed from its detail page', () => {
    test('returns the tool output for the submitted input', async ({ page }) => {
      await page.goto('/tools/simpleMcpTool');

      await expect(page.locator('h2')).toHaveText('simpleMcpTool');
      await expect(page.locator('[data-language="json"]')).toHaveText('{}');

      await page.getByLabel('The name of the person').fill('John Doe');
      await page.getByRole('button', { name: 'Submit' }).click();

      await expect(page.locator('[data-language="json"]')).toHaveText('{  "hello": "world",  "thisIsA": "fixture"}');
    });
  });

  test.describe('when a standalone tool route is opened', () => {
    test('exposes breadcrumb navigation back to the tools list', async ({ page }) => {
      await page.goto('/tools/simpleMcpTool');

      const breadcrumb = page.locator('header nav').first();
      await expect(breadcrumb.getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/tools');
      await expect(breadcrumb.locator('[aria-current="page"]')).toContainText('simpleMcpTool');
    });
  });
});
