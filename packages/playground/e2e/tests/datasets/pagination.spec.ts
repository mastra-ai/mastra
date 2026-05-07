import { test, expect } from '@playwright/test';
import { resetStorage, seedDatasets } from '../__utils__';

test.afterEach(async () => {
  await resetStorage();
});

test('datasets page paginates forward and backward across seeded datasets', async ({ page }) => {
  // Seed 12 datasets so two pages of 10 per page exist.
  // The API lists datasets newest-first, so "E2E Dataset 12" is on page 1
  // and "E2E Dataset 01" & "E2E Dataset 02" are on page 2.
  await seedDatasets(12);

  await page.goto('/datasets');

  // First page: 10 rows, newest first, "Next" is available, "Previous" is not.
  await expect(page.getByText('Page 1')).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 12/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 03/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 02/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous' })).toHaveCount(0);

  // Click Next: page 2 shows the 2 oldest datasets and "Next" disappears.
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Page 2')).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 02/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 01/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 12/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);

  // Click Previous: back to page 1 with the newest datasets visible.
  await page.getByRole('button', { name: 'Previous' }).click();

  await expect(page.getByText('Page 1')).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 12/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 02/ })).toHaveCount(0);
});

test('changing the search input resets pagination to page 1', async ({ page }) => {
  await seedDatasets(12);

  await page.goto('/datasets');

  // Move to page 2 first.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2')).toBeVisible();

  // Typing into the search input should drop the user back to page 1.
  await page.getByPlaceholder('Filter by dataset name').fill('E2E Dataset 12');

  await expect(page.getByText('Page 1')).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E Dataset 12/ })).toBeVisible();
});
