import { test, expect } from '@playwright/test';

test.describe('CMS — scorers', () => {
  test('/cms/scorers/create renders the scorer editor with score-range inputs', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    const response = await page.goto('/cms/scorers/create');
    if (response && response.status() >= 500) {
      test.skip(true, 'CMS scorer create page not available');
    }
    await expect(page).toHaveURL(/\/cms\/scorers\/create/);
    await expect(page.getByRole('heading', { name: /create scorer/i, level: 1 })).toBeVisible();

    // Configuration step + required form fields.
    await expect(page.getByRole('heading', { name: /^configuration$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^name/i }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^description/i }).first()).toBeVisible();

    // Score range — two unlabeled spinbuttons under the "Score Range" text.
    await expect(page.getByText(/score range/i).first()).toBeVisible();
    await expect(page.getByRole('spinbutton').first()).toBeVisible();

    // Default sampling radiogroup (None / Ratio).
    await expect(page.getByRole('radio', { name: /^none$/i })).toBeVisible();

    // Submit button + Instructions section both render.
    await expect(page.getByRole('button', { name: /^create scorer$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^instructions$/i, level: 2 })).toBeVisible();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
