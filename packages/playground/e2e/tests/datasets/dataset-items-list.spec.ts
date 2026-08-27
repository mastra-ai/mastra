import { test, expect } from '@playwright/test';
import { resetStorage, seedDatasetWithItems } from '../__utils__';

const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

test.afterEach(async () => {
  await resetStorage();
});

/**
 * FEATURE: Dataset items list
 * USER STORY: As a user, I want to view and manage items in a dataset so I can prepare data for experiments.
 * BEHAVIOR UNDER TEST: Items list displays data, supports selection, and enables bulk operations.
 */

test.describe('Dataset items list', () => {
  test.describe('when an item row is clicked', () => {
    test('opens the detail panel showing item metadata', async ({ page }) => {
      const { id: datasetId } = await seedDatasetWithItems(3);

      await page.goto(`/datasets/${datasetId}`);
      await expect(page.getByText('Test input 1')).toBeVisible();

      await page.getByRole('button', { name: /Test input 1/ }).click();

      // Scope to the detail panel's metadata list (a <dl> uniquely identified by its
      // "Dataset Id" field, which the list rows don't render), so the timestamp regex
      // can't accidentally match a datetime elsewhere on the page.
      const itemMetadata = page.locator('dl').filter({ hasText: 'Dataset Id' });
      await expect(itemMetadata).toBeVisible({ timeout: 5000 });
      // The "Created" timestamp renders as "MMM d, yyyy h:mm aaa", e.g. "May 29, 2026 1:08 pm".
      await expect(itemMetadata.getByText(/[A-Z][a-z]{2} \d{1,2}, \d{4} \d{1,2}:\d{2} (am|pm)/).first()).toBeVisible();
    });
  });

  test.describe('when an item checkbox is checked', () => {
    test('shows the contextual selection menu with a Delete Items entry', async ({ page }) => {
      const { id: datasetId } = await seedDatasetWithItems(3);

      await page.goto(`/datasets/${datasetId}`);
      await expect(page.getByText('Test input 1')).toBeVisible();

      // Checkboxes are always visible on the current version — no selection mode.
      const checkbox1 = page.getByRole('checkbox', { name: /Select item/i }).first();
      await expect(checkbox1).toBeVisible();
      await checkbox1.click();

      await page.getByRole('button', { name: /1 selected/i }).click();
      await expect(page.getByRole('menuitem', { name: /Delete Items/i })).toBeVisible();
    });
  });

  test.describe('when all items are bulk deleted', () => {
    test('removes the selected items from the list', async ({ page }) => {
      const { id: datasetId } = await seedDatasetWithItems(3);

      await page.goto(`/datasets/${datasetId}`);

      await expect(page.getByText('Test input 1')).toBeVisible();
      await expect(page.getByText('Test input 2')).toBeVisible();
      await expect(page.getByText('Test input 3')).toBeVisible();

      await page.getByRole('checkbox', { name: /Select all items/i }).click();

      await page.getByRole('button', { name: /3 selected/i }).click();
      await page.getByRole('menuitem', { name: /Delete Items/i }).click();

      const confirmButton = page.getByRole('button', { name: /^Delete$/i });
      await confirmButton.click();

      await expect(page.getByText('No items yet')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('when a search term is entered', () => {
    test('filters items by input content', async ({ page }) => {
      const { id: datasetId } = await seedDatasetWithItems(5);

      await page.goto(`/datasets/${datasetId}`);
      await expect(page.getByText('Test input 1')).toBeVisible();
      await expect(page.getByText('Test input 5')).toBeVisible();

      await page.getByPlaceholder(/Search/i).fill('input 3');

      await expect(page.getByText('Test input 3')).toBeVisible();
      await expect(page.getByText('Test input 1')).not.toBeVisible();
      await expect(page.getByText('Test input 5')).not.toBeVisible();
    });
  });

  test.describe('when the dataset is empty', () => {
    test('shows the empty state with add item actions', async ({ page }) => {
      const datasetRes = await fetch(`${BASE_URL}/api/datasets`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Empty E2E Dataset' }),
      });
      if (!datasetRes.ok) {
        throw new Error(`Failed to create empty dataset: ${datasetRes.status} ${datasetRes.statusText}`);
      }
      const dataset = (await datasetRes.json()) as { id: string };

      await page.goto(`/datasets/${dataset.id}`);

      await expect(page.getByText('No items yet')).toBeVisible();
      await expect(page.getByRole('button', { name: /Add Single Item/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Import CSV/i })).toBeVisible();
    });
  });

  test.describe('when the select-all checkbox is clicked', () => {
    test('selects all visible items', async ({ page }) => {
      const { id: datasetId } = await seedDatasetWithItems(3);

      await page.goto(`/datasets/${datasetId}`);
      await expect(page.getByText('Test input 1')).toBeVisible();

      await page.getByRole('checkbox', { name: /Select all items/i }).click();

      await expect(page.getByRole('button', { name: /3 selected/i })).toBeVisible();
    });
  });

  test.describe('when a selected item is unchecked', () => {
    test('clears the selection', async ({ page }) => {
      const { id: datasetId } = await seedDatasetWithItems(3);

      await page.goto(`/datasets/${datasetId}`);
      await expect(page.getByText('Test input 1')).toBeVisible();

      const checkbox = page.getByRole('checkbox', { name: /Select item/i }).first();
      await checkbox.click();
      await expect(page.getByRole('button', { name: /1 selected/i })).toBeVisible();

      await checkbox.click();

      await expect(page.getByRole('button', { name: /selected/i })).not.toBeVisible();
    });
  });
});
