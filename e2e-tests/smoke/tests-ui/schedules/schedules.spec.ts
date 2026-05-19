import { test, expect } from '@playwright/test';

test.describe('Workflow Schedules', () => {
  // NOTE: The smoke fixture intentionally does not register any scheduled
  // workflows (see e2e-tests/smoke/src/mastra/index.ts comment). This spec
  // verifies the page renders with its empty state without crashing.
  test('/workflows/schedules renders empty state', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/workflows/schedules');
    await expect(page).toHaveURL(/\/workflows\/schedules/);
    await expect(page.getByRole('heading', { name: /^schedules$/i }).first()).toBeVisible();
    await expect(page.getByText(/no schedules/i).first()).toBeVisible({ timeout: 15_000 });

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
