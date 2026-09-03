import { test, expect } from '@playwright/test';
import { resetStorage, seedDatasets } from '../__utils__';

test.afterEach(async () => {
  await resetStorage();
});

/**
 * FEATURE: Datasets list infinite scroll
 * USER STORY: As a user with many datasets, I want the list to load more entries as I scroll
 *             so I can browse all datasets without manual pagination.
 * BEHAVIOR UNDER TEST: The list loads 20 datasets per page, fetches the next page when the
 *                      end-of-list sentinel scrolls into view, and search filters loaded rows.
 */

test.describe('Datasets list infinite scroll', () => {
  test.describe('when 25 datasets are seeded across two pages', () => {
    test('loads the next page when scrolled to the bottom of the list', async ({ page }) => {
      // The API lists datasets newest-first with 20 per page, so the first page
      // holds "E2E Dataset 25".."E2E Dataset 06" and the remaining 5 load on scroll.
      await seedDatasets(25);

      await page.goto('/datasets');

      await expect(page.getByRole('link', { name: /E2E Dataset 25/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /E2E Dataset 06/ })).toHaveCount(1);
      await expect(page.getByRole('link', { name: /E2E Dataset 05/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /E2E Dataset/ })).toHaveCount(20);

      // Scroll the last loaded row into view; the sentinel right below it
      // triggers fetching the next page.
      await page.getByRole('link', { name: /E2E Dataset 06/ }).scrollIntoViewIfNeeded();

      await expect(page.getByRole('link', { name: /E2E Dataset 05/ })).toHaveCount(1);
      await page.getByRole('link', { name: /E2E Dataset 01/ }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('link', { name: /E2E Dataset 01/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /E2E Dataset/ })).toHaveCount(25);
    });
  });

  test.describe('when a search term is entered', () => {
    test('filters the loaded datasets by name', async ({ page }) => {
      await seedDatasets(12);

      await page.goto('/datasets');

      await expect(page.getByRole('link', { name: /E2E Dataset 12/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /E2E Dataset 01/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /E2E Dataset/ })).toHaveCount(12);

      await page.getByPlaceholder('Filter by dataset name').fill('E2E Dataset 12');

      await expect(page.getByRole('link', { name: /E2E Dataset 12/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /E2E Dataset 01/ })).toHaveCount(0);
      await expect(page.getByRole('link', { name: /E2E Dataset/ })).toHaveCount(1);
    });
  });
});
