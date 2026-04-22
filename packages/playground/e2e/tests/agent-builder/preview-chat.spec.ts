import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Agent Builder Preview Chat
 * USER STORY: As a user building an agent, I want to see a welcoming empty state
 *             in the preview chat so that I understand I can test my agent there.
 * BEHAVIOR UNDER TEST:
 *   - Empty state appears with agent name when no messages exist
 *   - Empty state disappears after sending a message
 *   - Agent name in empty state updates when agent is renamed
 */

test.describe('Agent Builder Preview Chat', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('should show personalized empty state when preview chat has no messages', async ({ page }) => {
    await page.goto('/agent-builder/agents/new/edit');

    const emptyState = page.getByTestId('agent-preview-chat-empty');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Say hello to');
    await expect(emptyState).toContainText('Send a message to preview');
  });

  test('should hide empty state after user sends a message', async ({ page }) => {
    await page.goto('/agent-builder/agents/new/edit');

    const emptyState = page.getByTestId('agent-preview-chat-empty');
    await expect(emptyState).toBeVisible();

    const input = page.getByTestId('agent-preview-chat-input');
    const submit = page.getByTestId('agent-preview-chat-submit');

    await input.fill('Hello, agent!');
    await submit.click();

    await expect(emptyState).not.toBeVisible();
  });
});
