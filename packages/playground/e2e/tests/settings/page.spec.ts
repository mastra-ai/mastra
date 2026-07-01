import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Settings page', () => {
  test.beforeEach(async () => {
    await resetStorage();
  });

  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the settings page is visited', () => {
    test('shows the page title and breadcrumb', async ({ page }) => {
      await page.goto('/settings');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expectCurrentBreadcrumb(page, 'Settings');
    });

    test('renders the settings form', async ({ page }) => {
      await page.goto('/settings');

      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('shows the theme selector defaulting to dark', async ({ page }) => {
      await page.goto('/settings');

      const selector = page.getByLabel('Theme mode');

      await expect(selector).toBeVisible();
      await expect(selector).toContainText('Dark');
    });
  });

  test.describe('when the light theme is selected', () => {
    test('applies the light theme and persists it across reloads', async ({ page }) => {
      await page.goto('/settings');

      const selector = page.getByLabel('Theme mode');

      await selector.click();
      await page.getByRole('option', { name: 'Light' }).click();

      await expect(selector).toContainText('Light');
      await expect(page.locator('html')).toHaveClass(/light/);

      await page.reload();

      await expect(page.locator('html')).toHaveClass(/light/);
      await expect(page.getByLabel('Theme mode')).toContainText('Light');
    });
  });

  test.describe('when the system theme mode is selected', () => {
    test('persists the system theme mode across reloads', async ({ page }) => {
      await page.goto('/settings');

      const selector = page.getByLabel('Theme mode');

      await selector.click();
      await page.getByRole('option', { name: 'System' }).click();

      await expect(selector).toContainText('System');

      await page.reload();

      await expect(page.getByLabel('Theme mode')).toContainText('System');
    });
  });
});
