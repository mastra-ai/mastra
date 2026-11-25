import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * The whole app is wrapped in `RoutePermissionsGate`, which blocks the router
 * (including the Settings page) until `/api/auth/capabilities` resolves. Studio
 * asks it first, and waits for the server when it doesn't answer.
 *
 * After saving a custom API prefix / instance URL and reloading, the capabilities
 * request is re-issued against the newly-configured prefix/URL. The kitchen-sink
 * server only serves the default `/api` prefix on its own origin, so for the
 * persistence tests we stub capabilities (auth disabled) for any prefix to let
 * the gate fall through to the Settings form. The error-state behaviour is
 * asserted separately, without that stub.
 */
async function stubCapabilitiesAuthDisabled(page: Page): Promise<void> {
  await page.route('**/auth/capabilities', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, login: null }),
    });
  });
}

test.describe('Settings API prefix persistence', () => {
  test.beforeEach(async ({ page }) => {
    await resetStorage();
    await stubCapabilitiesAuthDisabled(page);
  });

  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the settings page is first opened', () => {
    test('displays the default API prefix value', async ({ page }) => {
      await page.goto('/settings');

      const apiPrefixInput = page.locator('input[name="apiPrefix"]');
      await expect(apiPrefixInput).toBeVisible();
      await expect(apiPrefixInput).toHaveValue('/api');
    });
  });

  test.describe('when a custom API prefix is saved and the page reloaded', () => {
    test('persists the custom API prefix', async ({ page }) => {
      await page.goto('/settings');

      const apiPrefixInput = page.locator('input[name="apiPrefix"]');
      await expect(apiPrefixInput).toBeVisible();

      await apiPrefixInput.clear();
      await apiPrefixInput.fill('/custom-prefix');

      await page.getByRole('button', { name: 'Save changes' }).click();

      await page.reload();

      await expect(page.locator('input[name="apiPrefix"]')).toHaveValue('/custom-prefix');
    });
  });

  test.describe('when other settings are saved after a custom prefix', () => {
    test('preserves the API prefix', async ({ page }) => {
      await page.goto('/settings');

      const apiPrefixInput = page.locator('input[name="apiPrefix"]');
      await apiPrefixInput.clear();
      await apiPrefixInput.fill('/mastra');

      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.reload();

      // Change another setting (Mastra instance URL) but don't touch apiPrefix
      const urlInput = page.locator('input[name="url"]');
      await urlInput.clear();
      await urlInput.fill('http://localhost:5555');

      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.reload();

      // API prefix should still be /mastra
      await expect(page.locator('input[name="apiPrefix"]')).toHaveValue('/mastra');
    });
  });
});

test.describe('Settings unreachable instance URL', () => {
  test.beforeEach(async () => {
    await resetStorage();
  });

  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the configured API is unreachable after saving', () => {
    test('waits for the saved server and offers to go back to the default one', async ({ page }) => {
      // Stub capabilities ONLY for the initial load so we can reach the Settings form
      // to enter a bad URL. Once a bad instance URL is saved, the post-reload
      // capabilities request targets that dead origin and is not stubbed.
      await page.route('**/auth/capabilities', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ enabled: false, login: null }),
        });
      });

      await page.goto('/settings');

      const urlInput = page.locator('input[name="url"]');
      await expect(urlInput).toBeVisible();
      await urlInput.clear();
      // Unroutable address: connection fails fast, capabilities query errors.
      await urlInput.fill('http://127.0.0.1:1');

      await page.getByRole('button', { name: 'Save changes' }).click();

      // Drop the stub so the post-reload capabilities request really hits the dead
      // origin and fails.
      await page.unroute('**/auth/capabilities');
      await page.reload();

      await expect(page.getByText('Waiting for your Mastra server')).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Reset to default' }).click();
      await expect(page.locator('input[name="url"]')).toBeVisible();
    });
  });
});
