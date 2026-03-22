import { test, expect } from '@playwright/test';

test.describe('Request Context', () => {
  test('request context page displays editor and saves JSON', async ({ page }) => {
    await page.goto('/request-context');

    // Page heading
    await expect(page.getByRole('heading', { name: 'Request Context', level: 1 })).toBeVisible();

    // Label
    await expect(page.getByText('Request Context (JSON)')).toBeVisible();

    // CodeMirror editor with default content
    const editor = page.getByRole('textbox').and(page.locator('.cm-content'));
    await expect(editor).toBeVisible();

    // Save button
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    // Replace editor content with valid JSON
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('{"userId":"smoke-test-123"}');

    // Click Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Expect success toast
    await expect(page.getByText('Request context saved successfully')).toBeVisible({ timeout: 5_000 });

    // Reload and verify persistence (stored in localStorage via zustand)
    await page.reload();
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('smoke-test-123');
  });

  test('request context is included in agent chat and cleared to empty after removal', async ({ page }) => {
    const contextPayload = { tenantId: 'e2e-tenant-42', env: 'test' };

    // 1. Set request context via the Request Context page
    await page.goto('/request-context');
    const editor = page.getByRole('textbox').and(page.locator('.cm-content'));
    await expect(editor).toBeVisible();

    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(JSON.stringify(contextPayload));
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Request context saved successfully')).toBeVisible({ timeout: 5_000 });

    // 2. Navigate to agent chat and intercept the stream call
    await page.goto('/agents/test-agent/chat/new');
    await expect(page.getByRole('heading', { name: 'Test Agent' })).toBeVisible({ timeout: 10_000 });

    // Intercept the POST to the agent stream endpoint
    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/api/agents/test-agent/stream', async (route) => {
      const request = route.request();
      try {
        capturedBody = JSON.parse(request.postData() ?? '{}');
      } catch {
        capturedBody = null;
      }
      // Let the request go through
      await route.continue();
    });

    // Send a message
    const chatInput = page.getByRole('textbox', { name: /message/i });
    await chatInput.fill('say hello');
    await chatInput.press('Enter');

    // Wait for the stream response to start
    await expect(async () => {
      expect(capturedBody).not.toBeNull();
    }).toPass({ timeout: 15_000 });

    // Verify requestContext was included in the body
    const rc = capturedBody!.requestContext as Record<string, unknown>;
    expect(rc).toBeDefined();
    expect(rc.tenantId).toBe('e2e-tenant-42');
    expect(rc.env).toBe('test');

    // 3. Remove the request context via the UI
    await page.unroute('**/api/agents/test-agent/stream');
    await page.goto('/request-context');
    const editorClear = page.getByRole('textbox').and(page.locator('.cm-content'));
    await expect(editorClear).toBeVisible();

    // Focus and select all content, then replace with empty object
    await editorClear.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('{}');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Request context saved successfully')).toBeVisible({ timeout: 5_000 });

    // 4. Navigate to agent chat again and verify requestContext is empty
    let capturedBodyAfter: Record<string, unknown> | null = null;
    await page.goto('/agents/test-agent/chat/new');
    await expect(page.getByRole('heading', { name: 'Test Agent' })).toBeVisible({ timeout: 10_000 });

    await page.route('**/api/agents/test-agent/stream', async (route) => {
      const request = route.request();
      try {
        capturedBodyAfter = JSON.parse(request.postData() ?? '{}');
      } catch {
        capturedBodyAfter = null;
      }
      await route.continue();
    });

    const chatInput2 = page.getByRole('textbox', { name: /message/i });
    await chatInput2.fill('say hi');
    await chatInput2.press('Enter');

    await expect(async () => {
      expect(capturedBodyAfter).not.toBeNull();
    }).toPass({ timeout: 15_000 });

    // RequestContext should be an empty object — the app always sends the field,
    // but after clearing via the UI it should contain no keys
    const rcAfter = capturedBodyAfter!.requestContext as Record<string, unknown>;
    expect(rcAfter).toBeDefined();
    expect(Object.keys(rcAfter)).toHaveLength(0);
  });
});
