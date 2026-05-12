import { test, expect, Page } from '@playwright/test';
import { fillAndSend, waitForAssistantMessage } from '../helpers';

/**
 * Expand the left-slot collapsible panel if it's collapsed.
 * Waits for the panel content to be ready first.
 */
async function expandLeftPanel(page: Page) {
  const leftPanel = page.locator('#left-slot');
  // Wait for panel to render
  await expect(leftPanel).toBeVisible({ timeout: 10_000 });

  const newChatLink = leftPanel.getByRole('link', { name: 'New Chat' });
  const isExpanded = await newChatLink.isVisible().catch(() => false);
  if (!isExpanded) {
    // Panel is collapsed — click the expand button
    await leftPanel.locator('button').first().click();
  }
  await expect(newChatLink).toBeVisible({ timeout: 10_000 });
}

test.describe('Memory & Threads', () => {
  test('thread list shows threads after chat', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/agents/test-agent/chat/new');

    // Wait for the chat input to be ready (page fully loaded)
    await expect(page.getByPlaceholder('Enter your message...')).toBeEditable({ timeout: 15_000 });

    // Send a message to create a new thread
    await fillAndSend(page, 'Thread list test message');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });
    await waitForAssistantMessage(page);

    // Extract the thread ID from the URL
    const threadUrl = new URL(page.url());
    const threadPath = threadUrl.pathname; // e.g. /agents/test-agent/chat/<threadId>

    // Expand the thread sidebar
    await expandLeftPanel(page);
    const leftPanel = page.locator('#left-slot');

    // Verify the specific thread we created appears in the sidebar
    const threadLink = leftPanel.locator(`a[href="${threadPath}"]`);
    await expect(threadLink).toBeVisible({ timeout: 10_000 });
  });

  test('delete a thread', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/agents/test-agent/chat/new');

    // Send a message to create a thread we can delete
    await fillAndSend(page, 'Thread to be deleted');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });
    await waitForAssistantMessage(page);

    // Extract the thread path from the URL so we can target this specific thread
    const threadPath = new URL(page.url()).pathname;

    // Expand the thread sidebar
    await expandLeftPanel(page);
    const leftPanel = page.locator('#left-slot');

    // Find the specific thread entry we just created
    const threadLink = leftPanel.locator(`a[href="${threadPath}"]`);
    await expect(threadLink).toBeVisible({ timeout: 5_000 });

    // Find the <li> row that contains this thread's link, then its delete button.
    // Use page.locator for the inner selector so filter({ has }) scopes correctly.
    const threadRow = leftPanel.locator('li').filter({ has: page.locator(`a[href="${threadPath}"]`) });
    // Hover the row to reveal the delete button (it's hidden until hover)
    await threadRow.hover();
    const deleteButton = threadRow.getByLabel('delete thread');
    await deleteButton.click();

    // Confirmation dialog should appear
    await expect(page.getByText('Are you absolutely sure?')).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText('This action cannot be undone.'),
    ).toBeVisible();

    // Click "Continue" to confirm deletion
    await page.getByRole('button', { name: 'Continue' }).click();

    // The specific thread entry should disappear from the sidebar
    await expect(threadLink).not.toBeVisible({ timeout: 10_000 });
  });

  test('working memory display', async ({ page }) => {
    test.slow();
    await page.goto('/agents/test-agent/chat/new');

    // Before a thread exists, the Memory tab should show a hint
    await page.getByRole('tab', { name: 'Memory' }).click();
    await expect(page.getByRole('heading', { name: 'Working Memory', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Send a message to the agent to enable working memory.')).toBeVisible();

    // Send a message that gives the agent user information to store in working memory
    await fillAndSend(page, 'My name is SmokeTestUser99 and I live in San Francisco.');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });
    await waitForAssistantMessage(page);

    // Switch to Memory tab to see working memory
    await page.getByRole('tab', { name: 'Memory' }).click();

    // The Edit Working Memory button should be enabled (thread exists now)
    const editButton = page.getByRole('button', { name: 'Edit Working Memory' });
    await expect(editButton).toBeEnabled({ timeout: 10_000 });

    // The working memory should contain the facts extracted from the message.
    // The agent writes markdown with user info; verify both facts appear in the display.
    const rightPanel = page.locator('#right-slot');
    await expect(rightPanel).toContainText(/SmokeTestUser99/i, { timeout: 10_000 });
    await expect(rightPanel).toContainText(/San Francisco/i, { timeout: 10_000 });
  });

  test('working memory editing', async ({ page }) => {
    test.slow();
    await page.goto('/agents/test-agent/chat/new');

    // Send a message to create a thread with working memory
    await fillAndSend(page, 'My name is EditTestUser77 and I like pizza.');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });
    await waitForAssistantMessage(page);

    // Switch to Memory tab
    await page.getByRole('tab', { name: 'Memory' }).click();
    await expect(page.getByRole('heading', { name: 'Working Memory', exact: true })).toBeVisible({ timeout: 5_000 });

    // Click Edit Working Memory
    const editButton = page.getByRole('button', { name: 'Edit Working Memory' });
    await expect(editButton).toBeEnabled({ timeout: 10_000 });
    await editButton.click();

    // The working memory textarea (distinct from the chat input) should appear
    const wmTextarea = page.getByPlaceholder('Enter working memory content...');
    await expect(wmTextarea).toBeVisible({ timeout: 5_000 });

    // Save and Cancel buttons should be visible
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Test Cancel first — should return to read-only view
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(wmTextarea).not.toBeVisible({ timeout: 5_000 });
    await expect(editButton).toBeVisible();

    // Now edit and save
    await editButton.click();
    await expect(wmTextarea).toBeVisible({ timeout: 5_000 });

    // Clear and type new content
    await wmTextarea.clear();
    await wmTextarea.fill('# Custom Working Memory\n\nEdited by smoke test');

    // Click Save Changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Textarea should disappear after save
    await expect(wmTextarea).not.toBeVisible({ timeout: 10_000 });

    // The saved content should be visible in the working memory display
    await expect(page.getByText('Custom Working Memory')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Edited by smoke test')).toBeVisible();
  });
});
