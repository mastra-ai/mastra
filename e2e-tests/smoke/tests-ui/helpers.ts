import { expect, Page } from '@playwright/test';

/**
 * Fill the chat input and click Send.
 * Waits for the input to be editable before typing, and for Send to be enabled before clicking.
 */
export async function fillAndSend(page: Page, message: string) {
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
export async function waitForAssistantMessage(page: Page, timeout = 30_000) {
  const thread = page.getByTestId('thread-wrapper');
  // The assistant may emit multiple messages (e.g. tool calls then final text).
  // Grab the last assistant message so assertions match the final response.
  const assistantMsg = thread.locator('[data-message-index]').last();
  await expect(assistantMsg).toBeVisible({ timeout });
  return assistantMsg;
}
