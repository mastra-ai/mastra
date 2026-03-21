import { test, expect, Page } from '@playwright/test';

/**
 * Wait for a tool result containing the expected key, then parse and return the JSON.
 */
async function waitForToolResult(page: Page, expectedKey: string): Promise<unknown> {
  const jsonPanel = page.locator('[data-language="json"]');
  await expect(jsonPanel).toContainText(expectedKey, { timeout: 10_000 });
  const text = await jsonPanel.textContent();
  if (!text) throw new Error('Tool result panel has no text content');
  return JSON.parse(text);
}

test.describe('Tool Execution', () => {
  test('tools list page shows registered tools', async ({ page }) => {
    await page.goto('/tools');

    await expect(page.locator('h1')).toHaveText('Tools');
    await expect(page.getByRole('link', { name: 'calculator' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'string-transform' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'needs-approval' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'always-fails' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'timestamp' })).toBeVisible();
  });

  test('calculator tool: add 5 + 3 = 8', async ({ page }) => {
    await page.goto('/tools/calculator');

    await expect(page.locator('h2')).toHaveText('calculator');

    // Select operation
    await page.getByRole('combobox', { name: 'Operation' }).click();
    await page.getByRole('option', { name: 'add' }).click();

    // Fill inputs
    await page.getByRole('spinbutton', { name: 'A' }).fill('5');
    await page.getByRole('spinbutton', { name: 'B' }).fill('3');

    // Submit and verify
    await page.getByRole('button', { name: 'Submit' }).click();
    const result = await waitForToolResult(page, 'result');
    expect(result).toEqual({ result: 8 });
  });

  test('calculator tool: multiply 7 * 6 = 42', async ({ page }) => {
    await page.goto('/tools/calculator');

    await page.getByRole('combobox', { name: 'Operation' }).click();
    await page.getByRole('option', { name: 'multiply' }).click();

    await page.getByRole('spinbutton', { name: 'A' }).fill('7');
    await page.getByRole('spinbutton', { name: 'B' }).fill('6');
    await page.getByRole('button', { name: 'Submit' }).click();

    const result = await waitForToolResult(page, 'result');
    expect(result).toEqual({ result: 42 });
  });

  test('string-transform tool: uppercase', async ({ page }) => {
    await page.goto('/tools/string-transform');

    await expect(page.locator('h2')).toHaveText('string-transform');

    await page.getByRole('combobox', { name: 'Transform' }).click();
    await page.getByRole('option', { name: 'upper' }).click();

    await page.getByRole('textbox', { name: 'Text' }).fill('hello world');
    await page.getByRole('button', { name: 'Submit' }).click();

    const result = await waitForToolResult(page, 'result');
    expect(result).toEqual({ result: 'HELLO WORLD' });
  });

  test('timestamp tool: no input required', async ({ page }) => {
    await page.goto('/tools/timestamp');

    await expect(page.locator('h2')).toHaveText('timestamp');

    // No inputs to fill — just submit
    await page.getByRole('button', { name: 'Submit' }).click();

    const result = (await waitForToolResult(page, 'timestamp')) as { timestamp: number; iso: string };
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('string-transform tool: reverse', async ({ page }) => {
    await page.goto('/tools/string-transform');

    await page.getByRole('combobox', { name: 'Transform' }).click();
    await page.getByRole('option', { name: 'reverse' }).click();

    await page.getByRole('textbox', { name: 'Text' }).fill('abcdef');
    await page.getByRole('button', { name: 'Submit' }).click();

    const result = await waitForToolResult(page, 'result');
    expect(result).toEqual({ result: 'fedcba' });
  });

  test('needs-approval tool: executes in playground without approval gate', async ({ page }) => {
    await page.goto('/tools/needs-approval');

    await expect(page.locator('h2')).toHaveText('needs-approval');

    await page.getByRole('textbox', { name: 'Name' }).fill('SmokeTest');
    await page.getByRole('button', { name: 'Submit' }).click();

    // In the tool playground, requireApproval is bypassed — tool executes directly
    const result = await waitForToolResult(page, 'greeting');
    expect(result).toEqual({ greeting: 'Hello, SmokeTest!' });
  });

  // NOTE: The always-fails tool error is not surfaced in the UI result panel
  // (the JSON output stays "{}"). Skipping until the playground renders tool errors.
});
