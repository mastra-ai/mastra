import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.beforeEach(async () => {
  await resetStorage();
});

test.afterEach(async () => {
  await resetStorage();
});

test('has page title', async ({ page }) => {
  await page.goto('/settings');

  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('h1')).toHaveText('Settings');
});

test('renders settings form', async ({ page }) => {
  await page.goto('/settings');

  const form = page.locator('form');
  await expect(form).toBeVisible();
});

test('shows theme selector with dark default', async ({ page }) => {
  await page.goto('/settings');

  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');

  await expect(selector).toBeVisible();
  await expect(selector).toContainText('Dark');
});

test('applies selected light theme', async ({ page }) => {
  await page.goto('/settings');

  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');

  await selector.click();
  await page.getByRole('option', { name: 'Light' }).click();

  await expect(selector).toContainText('Light');
  await expect(page.locator('html')).toHaveClass(/light/);

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/light/);
  const reloadedThemeSection = page.getByText('Theme mode').locator('..');
  await expect(reloadedThemeSection.getByRole('combobox')).toContainText('Light');
});

test('persists system theme mode', async ({ page }) => {
  await page.goto('/settings');

  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');

  await selector.click();
  await page.getByRole('option', { name: 'System' }).click();

  await expect(selector).toContainText('System');

  await page.reload();

  const reloadedThemeSection = page.getByText('Theme mode').locator('..');
  await expect(reloadedThemeSection.getByRole('combobox')).toContainText('System');
});
