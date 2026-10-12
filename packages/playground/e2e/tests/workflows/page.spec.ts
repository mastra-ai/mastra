import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Workflows overview', () => {
  test.describe('when the complex-workflow row is clicked', () => {
    test('navigates to the complex-workflow graph page', async ({ page }) => {
      await page.goto('/workflows');
      await page.getByRole('link', { name: /^complex-workflow/ }).click();

      await expect(page).toHaveURL(/\/workflows\/complexWorkflow\/graph$/);
      await expect(page.getByText('complex-workflow').first()).toBeVisible();
    });
  });

  test.describe('when another workflow is picked from the sidebar switcher', () => {
    test('navigates to that workflow graph page', async ({ page }) => {
      await page.goto('/workflows/lessComplexWorkflow/graph');

      await page.getByLabel('Switch workflow').click();
      await page.getByRole('option', { name: 'complex-workflow' }).click();

      await expect(page).toHaveURL(/\/workflows\/complexWorkflow\/graph$/);
      await expect(page.getByText('complex-workflow').first()).toBeVisible();
    });
  });

  test.describe('when All workflows is clicked from an open workflow', () => {
    test('returns to the overview', async ({ page }) => {
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('link', { name: 'All workflows' }).click();

      await expect(page).toHaveURL(/\/workflows$/);
      await expect(page.getByRole('heading', { name: 'Workflows' })).toBeAttached();
    });
  });
});
