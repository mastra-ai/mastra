import { test, expect } from '@playwright/test';

test.describe('Observability Overview', () => {
  test('/observability-overview hub links navigate to Metrics and Traces routes', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/observability-overview');
    await expect(page).toHaveURL(/\/observability-overview/);
    await expect(page.getByRole('heading', { name: /^observability$/i, level: 1 })).toBeVisible();

    // Hub exposes navigation cards linking to /metrics and /observability.
    const metricsLink = page.getByRole('link', { name: /metrics/i }).first();
    await expect(metricsLink).toBeVisible();
    await expect(metricsLink).toHaveAttribute('href', /\/metrics/);

    const tracesLink = page.getByRole('link', { name: /traces/i }).first();
    await expect(tracesLink).toBeVisible();
    await expect(tracesLink).toHaveAttribute('href', /\/observability/);

    // Click through to /observability and assert the Traces page mounts.
    await tracesLink.click();
    await expect(page).toHaveURL(/\/observability/);
    await expect(page.getByRole('heading', { name: /traces/i }).first()).toBeVisible();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
