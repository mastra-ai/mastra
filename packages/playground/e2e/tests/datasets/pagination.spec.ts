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
      const seededNames = await seedDatasets(25);

      await page.goto('/datasets');

      const datasetLinks = page.getByRole('link', { name: /E2E Dataset/ });
      await expect(datasetLinks).toHaveCount(20);
      for (const name of seededNames.slice(5)) {
        await expect(page.getByRole('link', { name: new RegExp(`^${name}\\b`) })).toHaveCount(1);
      }

      // Scroll the last loaded row into view; the sentinel right below it
      // triggers fetching the next page.
      await page.getByRole('link', { name: /E2E Dataset 06/ }).scrollIntoViewIfNeeded();

      await page.getByRole('link', { name: /E2E Dataset 01/ }).scrollIntoViewIfNeeded();
      await expect(datasetLinks).toHaveCount(25);
      for (const name of seededNames) {
        await expect(page.getByRole('link', { name: new RegExp(`^${name}\\b`) })).toHaveCount(1);
      }
    });
  });

  test.describe('when a search term is entered', () => {
    test('filters the loaded datasets by name', async ({ page }) => {
      const seededNames = await seedDatasets(12);

      await page.goto('/datasets');

      const datasetLinks = page.getByRole('link', { name: /E2E Dataset/ });
      await expect(datasetLinks).toHaveCount(12);
      for (const name of seededNames) {
        await expect(page.getByRole('link', { name: new RegExp(`^${name}\\b`) })).toHaveCount(1);
      }

      await page.getByPlaceholder('Filter by dataset name').fill('E2E Dataset 12');

      await expect(datasetLinks).toHaveCount(1);
      await expect(datasetLinks).toHaveText([/^E2E Dataset 12\b/]);
    });
  });
});
