import { test, expect, Page } from '@playwright/test';

/**
 * Locate the result CodeMirror editor.
 * The page has two textboxes: the "Test Message" textarea and the unnamed
 * CodeMirror contenteditable. Filter to the one without an accessible name.
 */
function resultEditor(page: Page) {
  return page.getByRole('textbox').and(page.locator('.cm-content'));
}

test.describe('Processors', () => {
  test('processors list page shows registered processors', async ({ page }) => {
    await page.goto('/processors');

    await expect(page.locator('h1')).toHaveText('Processors');

    // Verify all three registered processors are listed
    await expect(page.getByRole('link', { name: 'Uppercase Processor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Suffix Processor' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tripwire Test Processor' })).toBeVisible();

    // Verify phase column headers are visible
    await expect(page.getByRole('button', { name: 'INPUT' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'RESULT' })).toBeVisible();
  });

  test('processor detail: run uppercase processor and verify result', async ({ page }) => {
    await page.goto('/processors/uppercase');

    // Verify processor info section — name appears as a paragraph heading
    await expect(page.getByRole('paragraph').filter({ hasText: 'Uppercase Processor' })).toBeVisible();

    // The default test message is pre-filled
    const testMessageField = page.getByRole('textbox', { name: 'Test Message' });
    await expect(testMessageField).toHaveValue('Hello, this is a test message.');

    // Click "Run Processor"
    await page.getByRole('button', { name: 'Run Processor' }).click();

    // Wait for the result JSON in the CodeMirror editor
    await expect(resultEditor(page)).toContainText('HELLO, THIS IS A TEST MESSAGE.', { timeout: 10_000 });

    // Verify the Status section shows the Success badge
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Success', { exact: true })).toBeVisible();
  });

  test('processor detail: run tripwire processor and verify tripwire result', async ({ page }) => {
    await page.goto('/processors/tripwire-test');

    // Verify processor info — name appears as a paragraph heading
    await expect(page.getByRole('paragraph').filter({ hasText: 'Tripwire Test Processor' })).toBeVisible();

    // Fill in a message that will trigger the tripwire
    const testMessageField = page.getByRole('textbox', { name: 'Test Message' });
    await testMessageField.fill('This message should BLOCK now');

    // Run the processor
    await page.getByRole('button', { name: 'Run Processor' }).click();

    // Wait for the result to contain the tripwire response
    await expect(resultEditor(page)).toContainText('"triggered": true', { timeout: 10_000 });

    // Verify the Failed and Tripwire Triggered badges appear
    await expect(page.getByText('Failed', { exact: true })).toBeVisible();
    await expect(page.getByText('Tripwire Triggered')).toBeVisible();

    // Verify the tripwire reason heading and text appear outside the JSON editor
    await expect(page.getByText('Tripwire Reason')).toBeVisible();
    // Use exact match to avoid collision with the same text in the JSON editor
    await expect(page.getByText('Content blocked by policy', { exact: true })).toBeVisible();
  });
});
