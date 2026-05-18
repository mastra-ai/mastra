import { test, expect } from '@playwright/test';

test.describe('Workflow Schedules', () => {
  test('/workflows/schedules renders the Schedules page heading', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/workflows/schedules');
    await expect(page).toHaveURL(/\/workflows\/schedules/);
    await expect(page.getByRole('heading', { name: /^schedules$/i }).first()).toBeVisible();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
