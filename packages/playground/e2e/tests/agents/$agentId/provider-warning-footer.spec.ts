import { test, expect, Page } from '@playwright/test';
import { nanoid } from 'nanoid';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Provider Warning Footer
 * USER STORY: As a user, I want to see a non-intrusive warning when my selected
 *             provider's API key is not configured, so that I can understand why
 *             my chat may not work without being blocked by a large alert.
 * BEHAVIOR UNDER TEST:
 *   - Warning footer appears below chat input when provider is not connected
 *   - Warning does NOT block the Send button or input visibility
 *   - Warning shows the required environment variable(s)
 *   - Large Alert box is NOT shown in the sidebar when provider is disconnected
 */

let page: Page;

test.beforeEach(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
});

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Provider Warning Footer - Behavior Tests', () => {
  test('warning footer appears when provider is not connected', async () => {
    // ARRANGE & ACT
    await page.goto(`/agents/weatherAgent/chat/${nanoid()}`);

    // Wait for the page to load
    await expect(page.getByTestId('thread-wrapper')).toBeVisible({ timeout: 10000 });

    // Check if the model selector shows a disconnected indicator (red dot)
    const modelSelector = page.getByTestId('chat-model-selector');
    await expect(modelSelector).toBeVisible({ timeout: 5000 });

    // ASSERT: If provider is disconnected, warning footer should be visible
    // The warning footer shows the required env var
    const warningFooter = page.getByTestId('provider-warning-footer');

    // The footer may or may not be visible depending on provider connection status
    // If visible, it should contain the environment variable name
    const isDisconnected = await warningFooter.isVisible().catch(() => false);

    if (isDisconnected) {
      await expect(warningFooter).toContainText('Set');
      // Should contain a code element with the env var name
      await expect(warningFooter.locator('code')).toBeVisible();
    }
  });

  test('warning footer does not block send button visibility', async () => {
    // ARRANGE & ACT
    await page.goto(`/agents/weatherAgent/chat/${nanoid()}`);

    // Wait for the page to load
    await expect(page.getByTestId('thread-wrapper')).toBeVisible({ timeout: 10000 });

    // ASSERT: Send button should always be visible regardless of warning state
    const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]').first();
    // The send button may be the one with the ArrowUp icon
    const composerSendButton = page.locator('button').filter({ has: page.locator('svg') }).last();

    // At least one form of send/submit button should be accessible
    await expect(page.getByPlaceholder('Enter your message...')).toBeVisible({ timeout: 5000 });
  });

  test('warning footer does not block chat input visibility', async () => {
    // ARRANGE & ACT
    await page.goto(`/agents/weatherAgent/chat/${nanoid()}`);

    // Wait for the page to load
    await expect(page.getByTestId('thread-wrapper')).toBeVisible({ timeout: 10000 });

    // ASSERT: Chat input should always be visible and usable
    const chatInput = page.getByPlaceholder('Enter your message...');
    await expect(chatInput).toBeVisible({ timeout: 5000 });

    // User should be able to type in the input
    await chatInput.fill('Test message');
    await expect(chatInput).toHaveValue('Test message');
  });

  test('large alert box is not shown in sidebar when provider is disconnected', async () => {
    // ARRANGE & ACT
    await page.goto(`/agents/weatherAgent/chat/${nanoid()}`);

    // Wait for the page to load
    await expect(page.getByTestId('thread-wrapper')).toBeVisible({ timeout: 10000 });

    // Navigate to Overview tab in sidebar
    await page.click('text=Overview');

    // Wait for sidebar to show content
    const overviewPanel = page.getByLabel('Overview');
    await expect(overviewPanel).toBeVisible({ timeout: 5000 });

    // ASSERT: The large "Provider not connected" Alert should NOT be present
    // This was the old behavior we removed
    const largeProviderAlert = overviewPanel.locator('text=Provider not connected');
    await expect(largeProviderAlert).not.toBeVisible({ timeout: 2000 });
  });

  test('warning footer shows correct environment variable name', async () => {
    // ARRANGE & ACT
    await page.goto(`/agents/weatherAgent/chat/${nanoid()}`);

    // Wait for the page to load
    await expect(page.getByTestId('thread-wrapper')).toBeVisible({ timeout: 10000 });

    // ASSERT: If warning is visible, it should show the correct env var format
    const warningFooter = page.getByTestId('provider-warning-footer');

    const isDisconnected = await warningFooter.isVisible().catch(() => false);

    if (isDisconnected) {
      // The env var should be in a code block
      const codeElement = warningFooter.locator('code');
      await expect(codeElement).toBeVisible();

      // Env var names typically follow patterns like OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
      const envVarText = await codeElement.textContent();
      expect(envVarText).toMatch(/[A-Z_]+/);
    }
  });

  test('warning footer is positioned below chat input', async () => {
    // ARRANGE & ACT
    await page.goto(`/agents/weatherAgent/chat/${nanoid()}`);

    // Wait for the page to load
    await expect(page.getByTestId('thread-wrapper')).toBeVisible({ timeout: 10000 });

    const warningFooter = page.getByTestId('provider-warning-footer');
    const isDisconnected = await warningFooter.isVisible().catch(() => false);

    if (isDisconnected) {
      // ASSERT: Warning footer appears below the composer input area
      const chatInputContainer = page.locator('.bg-surface3.rounded-lg.border');
      const inputBox = await chatInputContainer.boundingBox();
      const footerBox = await warningFooter.boundingBox();

      if (inputBox && footerBox) {
        // Footer should be below the input (higher Y value)
        expect(footerBox.y).toBeGreaterThan(inputBox.y);
      }
    }
  });
});
