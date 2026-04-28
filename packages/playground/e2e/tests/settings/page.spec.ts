import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Settings Page — Theme Selection
 * USER STORY: As a user, I want to select a theme (dark/light/system) from a dropdown
 *             so that the studio matches my preference.
 * BEHAVIOR: Theme selection is instant (no save button required) and persists
 *           across page reloads via localStorage.
 */

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

test('shows theme dropdown with dark selected by default', async ({ page }) => {
  await page.goto('/settings');

  const trigger = page.getByText('Theme mode').locator('..').getByRole('combobox');

  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText('Dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('applies light theme immediately on selection', async ({ page }) => {
  await page.goto('/settings');

  const trigger = page.getByText('Theme mode').locator('..').getByRole('combobox');

  await trigger.click();
  await page.getByRole('option', { name: 'Light' }).click();

  await expect(page.locator('html')).toHaveClass(/light/);
  await expect(trigger).toContainText('Light');
});

test('persists selected theme after page reload', async ({ page }) => {
  await page.goto('/settings');

  const trigger = page.getByText('Theme mode').locator('..').getByRole('combobox');

  await trigger.click();
  await page.getByRole('option', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveClass(/light/);

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/light/);
  const reloadedTrigger = page.getByText('Theme mode').locator('..').getByRole('combobox');
  await expect(reloadedTrigger).toContainText('Light');
});

test('persists system theme mode after page reload', async ({ page }) => {
  await page.goto('/settings');

  const trigger = page.getByText('Theme mode').locator('..').getByRole('combobox');

  await trigger.click();
  await page.getByRole('option', { name: 'System' }).click();
  await expect(trigger).toContainText('System');

  await page.reload();

  const reloadedTrigger = page.getByText('Theme mode').locator('..').getByRole('combobox');
  await expect(reloadedTrigger).toContainText('System');
});
