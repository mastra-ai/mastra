import { test, expect, type Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

const seedThemeInLocalStorage = async (page: Page, themeToggle: 'true' | 'false') => {
  await page.addInitScript(toggle => {
    Object.defineProperty(window, 'MASTRA_THEME_TOGGLE', {
      value: toggle,
      writable: false,
      configurable: false,
    });

    if (toggle !== 'true') {
      return;
    }

    if (!window.localStorage.getItem('mastra-playground-store')) {
      window.localStorage.setItem(
        'mastra-playground-store',
        JSON.stringify({ state: { requestContext: [], theme: 'dark' }, version: 0 }),
      );
    }
  }, themeToggle);
};

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

test('keeps theme selector hidden when theme flag is disabled', async ({ page }) => {
  await seedThemeInLocalStorage(page, 'false');

  await page.goto('/settings');

  await expect(page.getByText('Theme mode')).toHaveCount(0);
});

test('shows theme selector with dark default when theme flag is enabled', async ({ page }) => {
  await seedThemeInLocalStorage(page, 'true');

  await page.goto('/settings');

  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');

  await expect(selector).toBeVisible();
  await expect(selector).toContainText('Dark');
});

test('applies selected light theme only after saving configuration', async ({ page }) => {
  await seedThemeInLocalStorage(page, 'true');

  await page.goto('/settings');

  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');

  await selector.click();
  await page.getByRole('option', { name: 'Light' }).click();

  await expect(selector).toContainText('Light');
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Save Configuration' }).click();

  await expect(page.locator('html')).toHaveClass(/light/);

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/light/);
  const reloadedThemeSection = page.getByText('Theme mode').locator('..');
  await expect(reloadedThemeSection.getByRole('combobox')).toContainText('Light');
});

test('persists system theme mode when saved', async ({ page }) => {
  await seedThemeInLocalStorage(page, 'true');

  await page.goto('/settings');

  const themeSection = page.getByText('Theme mode').locator('..');
  const selector = themeSection.getByRole('combobox');

  await selector.click();
  await page.getByRole('option', { name: 'System' }).click();

  await expect(selector).toContainText('System');

  await page.getByRole('button', { name: 'Save Configuration' }).click();

  await page.reload();

  const reloadedThemeSection = page.getByText('Theme mode').locator('..');
  await expect(reloadedThemeSection.getByRole('combobox')).toContainText('System');
});
