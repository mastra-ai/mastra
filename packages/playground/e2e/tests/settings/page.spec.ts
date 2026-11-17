import { test, expect } from '@playwright/test';

test.describe('Settings page', () => {
  test.describe('when the settings page is visited', () => {
    test('shows the page title', async ({ page }) => {
      await page.goto('/settings');

      await expect(page).toHaveTitle(/Mastra Studio/);
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    });

    test('renders the settings form', async ({ page }) => {
      await page.goto('/settings');

      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('shows the theme selector defaulting to the system theme', async ({ page }) => {
      await page.goto('/settings');

      const selector = page.getByRole('radiogroup', { name: 'Theme' });

      await expect(selector).toBeVisible();
      await expect(selector.getByRole('radio', { name: 'System' })).toBeChecked();
    });
  });

  test.describe('when the light theme is selected', () => {
    test('applies the light theme and persists it across reloads', async ({ page }) => {
      await page.goto('/settings');

      const selector = page.getByRole('radiogroup', { name: 'Theme' });

      await selector.getByRole('radio', { name: 'Light' }).click();

      await expect(selector.getByRole('radio', { name: 'Light' })).toBeChecked();
      await expect(page.locator('html')).toHaveClass(/light/);

      await page.reload();

      await expect(page.locator('html')).toHaveClass(/light/);
      await expect(selector.getByRole('radio', { name: 'Light' })).toBeChecked();
    });
  });

  test.describe('when the system theme mode is selected', () => {
    test('persists the system theme mode across reloads', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/settings');

      const selector = page.getByRole('radiogroup', { name: 'Theme' });

      await selector.getByRole('radio', { name: 'Light' }).click();
      await expect(selector.getByRole('radio', { name: 'Light' })).toBeChecked();
      await selector.getByRole('radio', { name: 'System' }).click();

      await expect(selector.getByRole('radio', { name: 'System' })).toBeChecked();
      await expect(page.locator('html')).toHaveClass(/dark/);

      await page.reload();

      await expect(selector.getByRole('radio', { name: 'System' })).toBeChecked();
      await expect(page.locator('html')).toHaveClass(/dark/);

      await page.emulateMedia({ colorScheme: 'light' });
      await expect(page.locator('html')).toHaveClass(/light/);
    });
  });
});
