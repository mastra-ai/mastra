import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.beforeEach(async () => {
  await resetStorage();
});

test.afterEach(async () => {
  await resetStorage();
});

test('displays the default API prefix value', async ({ page }) => {
  await page.goto('/settings');

  const apiPrefixInput = page.locator('input[name="apiPrefix"]');
  await expect(apiPrefixInput).toBeVisible();
  await expect(apiPrefixInput).toHaveValue('/api');
});

test('persists custom API prefix after saving and reloading', async ({ page }) => {
  await page.goto('/settings');

  const apiPrefixInput = page.locator('input[name="apiPrefix"]');
  await expect(apiPrefixInput).toBeVisible();

  await apiPrefixInput.clear();
  await apiPrefixInput.fill('/custom-prefix');

  await page.getByRole('button', { name: 'Save Configuration' }).click();

  await page.reload();

  await expect(page.locator('input[name="apiPrefix"]')).toHaveValue('/custom-prefix');
});

test('preserves API prefix when saving other settings', async ({ page }) => {
  await page.goto('/settings');

  const apiPrefixInput = page.locator('input[name="apiPrefix"]');
  await apiPrefixInput.clear();
  await apiPrefixInput.fill('/mastra');

  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await page.reload();

  // Change theme but don't touch apiPrefix
  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');
  await selector.click();
  await page.getByRole('option', { name: 'Light' }).click();

  await page.getByRole('button', { name: 'Save Configuration' }).click();
  await page.reload();

  // API prefix should still be /mastra
  await expect(page.locator('input[name="apiPrefix"]')).toHaveValue('/mastra');
});
