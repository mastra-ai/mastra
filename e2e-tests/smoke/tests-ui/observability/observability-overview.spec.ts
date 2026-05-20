import { test, expect } from '@playwright/test';

test.describe('Observability routes', () => {
  test('/metrics and /observability mount their pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    // Traces page
    await page.goto('/observability');
    await expect(page).toHaveURL(/\/observability/);
    await expect(page.getByRole('heading', { name: /traces/i }).first()).toBeVisible();

    // Metrics page
    await page.goto('/metrics');
    await expect(page).toHaveURL(/\/metrics/);
    await expect(page.getByRole('heading', { name: /metrics/i }).first()).toBeVisible();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
