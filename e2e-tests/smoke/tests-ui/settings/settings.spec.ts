import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('settings page displays configuration form', async ({ page }) => {
    await page.goto('/settings');

    // Page heading
    await expect(page.locator('h1')).toHaveText('Settings');

    // Mastra instance URL field is pre-filled with the running server URL
    const urlInput = page.getByPlaceholder('e.g: http://localhost:4111');
    await expect(urlInput).toBeVisible();
    const urlValue = await urlInput.inputValue();
    expect(urlValue).toContain('4555');

    // API prefix field
    const prefixInput = page.getByPlaceholder('e.g: /api (default)');
    await expect(prefixInput).toBeVisible();

    // Headers section with add button
    await expect(page.getByRole('heading', { name: 'Headers' })).toBeVisible();
    await expect(page.getByText('No header yet')).toBeVisible();
    const addHeaderBtn = page.getByRole('button', { name: 'Add Header' });
    await expect(addHeaderBtn).toBeVisible();

    // Save button
    await expect(page.getByRole('button', { name: 'Save Configuration' })).toBeVisible();

    // Add a header and verify the name/value fields appear
    await addHeaderBtn.click();
    const headerNameInput = page.getByPlaceholder('e.g. Authorization');
    const headerValueInput = page.getByPlaceholder('e.g. Bearer <token>');
    await expect(headerNameInput).toBeVisible();
    await expect(headerValueInput).toBeVisible();
    // "No header yet" text disappears once a header row exists
    await expect(page.getByText('No header yet')).not.toBeVisible();

    // Remove the header via the trash button
    await page.getByRole('button', { name: 'Remove header' }).click();
    await expect(headerNameInput).not.toBeVisible();
    await expect(page.getByText('No header yet')).toBeVisible();
  });
});
