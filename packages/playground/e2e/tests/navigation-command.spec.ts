import { test, expect } from '@playwright/test';
import { resetStorage } from './__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('command palette opens with Cmd+K', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByPlaceholder('Search or navigate...')).toBeVisible();
});

test('command palette opens with Ctrl+K', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('command palette closes with Escape', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('command palette navigates to All Workflows', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Meta+k');
  await page.getByPlaceholder('Search or navigate...').fill('All Workflows');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/workflows$/);
});

test('command palette navigates to selected agent', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Meta+k');
  await page.getByPlaceholder('Search or navigate...').fill('Weather');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/agents\/weather-agent/);
});

test('command palette filters results based on search', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Meta+k');
  const dialog = page.getByRole('dialog');

  // Type to filter
  await page.getByPlaceholder('Search or navigate...').fill('observability');

  // Should show observability navigation item
  await expect(dialog.getByText('Observability')).toBeVisible();
});

test('command palette shows Navigation group', async ({ page }) => {
  await page.goto('/agents');

  await page.keyboard.press('Meta+k');
  const dialog = page.getByRole('dialog');

  await expect(dialog.getByText('Navigation')).toBeVisible();
  await expect(dialog.getByText('All Agents')).toBeVisible();
  await expect(dialog.getByText('All Workflows')).toBeVisible();
});
