import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Request Context lives in the composer
 * USER STORY: As a user configuring an agent that declares a `requestContextSchema`,
 * I want to edit request-context values from the chat composer (next to Model settings)
 * instead of from the right-side information panel, so configuration stays with
 * the other per-run controls (model settings, tracing).
 *
 * BEHAVIOR UNDER TEST:
 * 1. Agents with a requestContextSchema expose a "Request context" button in the composer.
 * 2. Clicking it opens a dialog with the schema-driven form; saving values persists them
 *    (covered by the existing RequestContextSchemaForm + SchemaRequestContextProvider).
 * 3. Agents without a requestContextSchema do NOT render the button.
 * 4. The right-side information panel no longer hosts a "Request Context" tab.
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Agent composer - Request context', () => {
  test('shows Request context button in composer for agent with schema and opens form', async ({ page }) => {
    await page.goto('/agents/context-schema-agent/chat/new');

    const button = page.getByRole('button', { name: 'Request context' });
    await expect(button).toBeVisible();

    await button.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Request context', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText('userId')).toBeVisible();
    await expect(dialog.getByText('tier')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('does not render Request context button for agent without schema', async ({ page }) => {
    await page.goto('/agents/weather-agent/chat/new');

    // Wait until the composer is mounted (Model settings is always present for agents).
    await expect(page.getByRole('button', { name: 'Model settings' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Request context' })).toHaveCount(0);
  });

  test('right-side information panel no longer exposes a Request Context tab', async ({ page }) => {
    await page.goto('/agents/context-schema-agent/chat/new');

    // Ensure the chat page has fully rendered.
    await expect(page.getByRole('button', { name: 'Request context' })).toBeVisible();

    // The right panel tab/list that previously housed Request Context should not exist.
    await expect(page.getByRole('tab', { name: 'Request Context' })).toHaveCount(0);
  });
});
