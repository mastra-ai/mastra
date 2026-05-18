import { test, expect } from '@playwright/test';

test.describe('Evaluation Dashboard', () => {
  test('/evaluation renders the dashboard with its sub-tabs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/evaluation');
    await expect(page).toHaveURL(/\/evaluation/);
    await expect(page.getByRole('heading', { name: /evaluation/i }).first()).toBeVisible();

    // The page exposes nested sections — match on visible section titles
    // to catch a navigation regression that hides the dashboard.
    const sectionHits = await Promise.race([
      page.getByText(/experiments/i).first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false),
      page.getByText(/review pipeline/i).first().waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false),
    ]);
    expect(sectionHits, 'expected an Evaluation section heading to be visible').toBe(true);

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
