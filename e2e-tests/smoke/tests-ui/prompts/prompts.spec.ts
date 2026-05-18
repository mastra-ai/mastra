import { test, expect } from '@playwright/test';

test.describe('Prompt Blocks', () => {
  test('/prompts list page shows the empty state when no prompts exist', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/prompts');
    await expect(page).toHaveURL(/\/prompts/);
    await expect(page.getByRole('heading', { name: /prompts/i }).first()).toBeVisible();

    // The smoke fixture has no stored prompt blocks → empty-state CTA visible
    // and the docs link points at mastra.ai (not a dead href).
    await expect(page.getByText(/no prompts yet/i).first()).toBeVisible();
    const docsLink = page.getByRole('link', { name: /prompts documentation/i }).first();
    await expect(docsLink).toBeVisible();
    await expect(docsLink).toHaveAttribute('href', /mastra\.ai/);

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('/cms/prompts/create renders the editor form fields', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    const response = await page.goto('/cms/prompts/create');
    if (response && response.status() >= 500) {
      test.skip(true, 'CMS prompt create page not available');
    }
    await expect(page.getByRole('heading', { name: /create prompt block/i, level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^configuration$/i, level: 2 })).toBeVisible();
    const nameInput = page.getByRole('textbox', { name: /^name/i }).first();
    await expect(nameInput).toBeVisible();
    await expect(page.getByRole('heading', { name: /^variables$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: /add variable/i }).first()).toBeVisible();

    // Submit button is mounted.
    await expect(page.getByRole('button', { name: /^create prompt block$/i })).toBeVisible();

    // Filling Name keeps the typed value (basic interactivity check).
    await nameInput.fill('smoke-prompt-block');
    await expect(nameInput).toHaveValue('smoke-prompt-block');

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });
});
