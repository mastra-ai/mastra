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
  });

  test('custom header is sent in API requests after saving', async ({ page }) => {
    await page.goto('/settings');

    // Add a custom header
    await page.getByRole('button', { name: 'Add Header' }).click();
    const headerNameInput = page.getByPlaceholder('e.g. Authorization');
    const headerValueInput = page.getByPlaceholder('e.g. Bearer <token>');
    await headerNameInput.fill('X-Smoke-Test');
    await headerValueInput.fill('header-value-42');

    // Save configuration
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    // Verify the header row is still visible after save
    await expect(headerNameInput).toHaveValue('X-Smoke-Test');
    await expect(headerValueInput).toHaveValue('header-value-42');

    // Intercept API requests to verify the custom header is included
    const capturedHeaders: Record<string, string>[] = [];
    await page.route('**/api/**', async route => {
      capturedHeaders.push(Object.fromEntries(
        Object.entries(route.request().headers()).map(([k, v]) => [k.toLowerCase(), v]),
      ));
      await route.continue();
    });

    // Navigate to agents page — this triggers API calls (e.g. list agents)
    await page.goto('/agents');
    await expect(page.locator('h1')).toHaveText('Agents');

    // Wait for at least one API request to be captured
    await expect(() => expect(capturedHeaders.length).toBeGreaterThan(0)).toPass({ timeout: 5_000 });

    // Verify the custom header was sent
    const headerSent = capturedHeaders.some(h => h['x-smoke-test'] === 'header-value-42');
    expect(headerSent).toBeTruthy();

    // Go back to settings and remove the header
    await page.goto('/settings');
    await expect(page.getByPlaceholder('e.g. Authorization')).toHaveValue('X-Smoke-Test');
    await page.getByRole('button', { name: 'Remove header' }).click();
    await expect(page.getByText('No header yet')).toBeVisible();

    // Save to persist the removal
    await page.getByRole('button', { name: 'Save Configuration' }).click();

    // Remove the first route handler before registering a fresh one
    await page.unroute('**/api/**');
    const headersAfterRemoval: Record<string, string>[] = [];
    await page.route('**/api/**', async route => {
      headersAfterRemoval.push(Object.fromEntries(
        Object.entries(route.request().headers()).map(([k, v]) => [k.toLowerCase(), v]),
      ));
      await route.continue();
    });

    await page.goto('/agents');
    await expect(page.locator('h1')).toHaveText('Agents');
    await expect(() => expect(headersAfterRemoval.length).toBeGreaterThan(0)).toPass({ timeout: 5_000 });

    // Custom header should no longer be present
    const headerStillSent = headersAfterRemoval.some(h => 'x-smoke-test' in h);
    expect(headerStillSent).toBeFalsy();
  });
});
