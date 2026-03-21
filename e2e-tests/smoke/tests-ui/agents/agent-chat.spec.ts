import { test, expect, Page } from '@playwright/test';

/**
 * Fill the chat input and click Send.
 * Waits for the input to be editable before typing, and for Send to be enabled before clicking.
 */
async function fillAndSend(page: Page, message: string) {
  const chatInput = page.getByPlaceholder('Enter your message...');
  await expect(chatInput).toBeEditable({ timeout: 5_000 });
  await chatInput.click();
  await chatInput.pressSequentially(message, { delay: 10 });
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Send' }).click();
}

/**
 * Wait for the assistant message to appear in the thread.
 * Uses data-message-index to find the first non-user message.
 */
async function waitForAssistantMessage(page: Page, timeout = 30_000) {
  const thread = page.getByTestId('thread-wrapper');
  // Wait for any message beyond the user's (index > 0)
  const assistantMsg = thread.locator('[data-message-index]').nth(1);
  await expect(assistantMsg).toBeVisible({ timeout });
  return assistantMsg;
}

test.describe('Agent Chat', () => {
  test('agents list page shows registered agents', async ({ page }) => {
    await page.goto('/agents');

    await expect(page.locator('h1')).toHaveText('Agents');
    await expect(page.getByRole('link', { name: 'Test Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approval Agent' })).toBeVisible();
  });

  test('agent chat page shows overview panel', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Header and title
    await expect(page).toHaveTitle(/Mastra Studio/);
    await expect(page.locator('h2:has-text("Test Agent")')).toBeVisible();

    // Overview tab is selected by default
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Model Settings' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Memory' })).toBeVisible();

    // Tools section lists attached tools
    await expect(page.getByRole('link', { name: 'calculator' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'string-transform' })).toBeVisible();

    // System prompt is shown
    await expect(page.getByText('You are a helpful test agent.')).toBeVisible();

    // Chat input
    await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('send message and receive streamed response', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    await fillAndSend(page, 'What is 2 + 2? Reply with just the number, nothing else.');

    // Wait for navigation to the thread URL
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });

    // Verify our message appears in the thread
    const thread = page.getByTestId('thread-wrapper');
    await expect(thread.getByText('What is 2 + 2?')).toBeVisible({ timeout: 10_000 });

    // Wait for the assistant response and verify it contains "4"
    const assistantMsg = await waitForAssistantMessage(page);
    await expect(assistantMsg).toContainText('4', { timeout: 30_000 });
  });

  test('send message with generate mode', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Switch to Generate mode
    await page.getByRole('tab', { name: 'Model Settings' }).click();
    await page.getByLabel('Generate').click();
    await page.getByRole('tab', { name: 'Overview' }).click();

    await fillAndSend(page, 'Say the word hello and nothing else.');

    // Wait for navigation
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });

    // Wait for the assistant response and verify it contains "hello"
    const assistantMsg = await waitForAssistantMessage(page);
    await expect(assistantMsg).toContainText(/hello/i, { timeout: 30_000 });
  });

  test('model settings persist after reload', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Switch to Model Settings tab
    await page.getByRole('tab', { name: 'Model Settings' }).click();

    // Verify default stream mode
    await expect(page.getByLabel('Stream')).toHaveAttribute('aria-checked', 'true');

    // Switch to Generate mode and change Max Steps
    await page.getByLabel('Generate').click();
    await page.click('text=Advanced Settings');
    await page.getByLabel('Max Steps').fill('3');

    // Reload and verify both Generate mode and Max Steps persisted
    await page.reload();
    await page.getByRole('tab', { name: 'Model Settings' }).click();
    await expect(page.getByLabel('Generate')).toHaveAttribute('aria-checked', 'true');
    await page.click('text=Advanced Settings');
    await expect(page.getByLabel('Max Steps')).toHaveValue('3');
  });

  test('new chat button navigates to fresh thread', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Send a message first so we're on a real thread URL
    await fillAndSend(page, 'Hi');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });

    // Now click New Chat and verify we get a fresh thread
    const newChatLink = page.getByRole('link', { name: 'New Chat' });
    await expect(newChatLink).toBeVisible();
    await newChatLink.click();
    await expect(page).toHaveURL(/\/chat\/new/);

    // Verify the chat input is empty and ready
    await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your message...')).toBeEmpty();
  });
});
