import { test, expect, Page } from '@playwright/test';
import { fillAndSend, waitForAssistantMessage } from '../helpers';

/**
 * Expand the left-slot collapsible panel if it's collapsed.
 * When collapsed, the panel renders only an expand button.
 * When already expanded, thread list content is visible.
 */
async function expandLeftPanel(page: Page) {
  const leftPanel = page.locator('#left-slot');
  const newChatText = leftPanel.getByText('New Chat');
  const isExpanded = await newChatText.isVisible().catch(() => false);
  if (!isExpanded) {
    // Panel is collapsed — the only button inside is the expand arrow
    await leftPanel.locator('button').first().click();
  }
  await expect(newChatText).toBeVisible({ timeout: 10_000 });
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

  test('thread sidebar lists previous conversations', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/agents/test-agent/chat/new');

    // Send a message to create a thread
    await fillAndSend(page, 'Hello from thread sidebar test');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });
    await waitForAssistantMessage(page);

    // Expand the thread sidebar if collapsed
    await expandLeftPanel(page);

    // At least one thread entry should appear (the one we just created)
    // Thread entries are links inside ThreadItem components that are NOT "New Chat"
    const leftPanel = page.locator('#left-slot');
    const threadEntries = leftPanel.locator('a').filter({ hasNotText: 'New Chat' });
    await expect(threadEntries.first()).toBeVisible({ timeout: 10_000 });
  });

  test('click previous thread to reload it', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/agents/test-agent/chat/new');

    // Send a message to create the first thread
    await fillAndSend(page, 'First thread message for reload test');
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });
    await waitForAssistantMessage(page);
    const firstThreadUrl = page.url();

    // Start a new chat to create a second context
    await page.getByRole('link', { name: 'New Chat' }).click();
    await expect(page).toHaveURL(/\/chat\/new/);

    // Expand the thread sidebar if collapsed
    await expandLeftPanel(page);

    // Click the first previous thread entry (not "New Chat")
    const leftPanel = page.locator('#left-slot');
    const threadEntries = leftPanel.locator('a').filter({ hasNotText: 'New Chat' });
    await expect(threadEntries.first()).toBeVisible({ timeout: 10_000 });
    await threadEntries.first().click();

    // Should navigate back to the exact same thread URL
    await expect(page).toHaveURL(firstThreadUrl, { timeout: 10_000 });

    // The previous message should be visible in the reloaded thread
    const thread = page.getByTestId('thread-wrapper');
    await expect(thread.getByText('First thread message for reload test')).toBeVisible({ timeout: 10_000 });
  });

  test('tool call displayed in chat message', async ({ page }) => {
    test.slow();
    await page.goto('/agents/test-agent/chat/new');

    // Ask the agent to use the calculator tool explicitly
    await fillAndSend(page, 'Use the calculator tool to add 5 and 3. You must call the calculator tool.');

    // Wait for navigation to thread
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });

    // Wait for the tool badge to appear in the chat
    const toolBadge = page.getByTestId('tool-badge');
    await expect(toolBadge.first()).toBeVisible({ timeout: 30_000 });

    // Verify the tool badge shows the calculator tool name
    await expect(toolBadge.first()).toContainText('calculator');

    // Click the tool badge to expand it and check for tool arguments
    await toolBadge.first().locator('button').first().click();
    await expect(page.getByText('Tool arguments')).toBeVisible({ timeout: 5_000 });
  });

  test('memory tab shows working memory', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Switch to the Memory tab
    await page.getByRole('tab', { name: 'Memory' }).click();

    // Working Memory heading should be visible
    await expect(page.getByRole('heading', { name: 'Working Memory' })).toBeVisible({ timeout: 5_000 });

    // Before a thread exists, the edit button should be disabled with a hint
    await expect(page.getByText('Edit Working Memory')).toBeVisible();

    // The hint text for no thread should be shown
    await expect(page.getByText('Send a message to the agent to enable working memory.')).toBeVisible();
  });

  test('approval agent triggers tool approval flow', async ({ page }) => {
    test.slow();
    await page.goto('/agents/approval-agent/chat/new');

    // Verify we're on the approval agent page
    await expect(page.locator('h2:has-text("Approval Agent")')).toBeVisible();

    // Ask the agent to greet someone — this should trigger the needs-approval tool
    await fillAndSend(page, 'Please greet John');

    // The tool badge for needs-approval should appear, auto-expanded because of approval metadata.
    // Wait for the tool badge first — URL navigation may happen before or after.
    const toolBadge = page.getByTestId('tool-badge');
    await expect(toolBadge.first()).toBeVisible({ timeout: 30_000 });
    await expect(toolBadge.first()).toContainText('needs-approval');

    // "Approval required" text should be visible (badge auto-expands for approval tools)
    await expect(page.getByText('Approval required')).toBeVisible({ timeout: 10_000 });

    // Approve and Decline buttons should be visible
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible();

    // Click Approve
    await page.getByRole('button', { name: 'Approve' }).click();

    // After approval, the tool should execute and show the greeting result
    await expect(page.getByText('Tool result')).toBeVisible({ timeout: 30_000 });
    // The tool returns { greeting: "Hello, John!" } — verify the result contains the name
    await expect(page.getByTestId('tool-result')).toContainText('John');
  });

  test('agent overview shows correct tools list', async ({ page }) => {
    // Verify test-agent tools
    await page.goto('/agents/test-agent/chat/new');
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    // Tools section should list exactly calculator and string-transform
    const toolBadges = page.locator('[data-testid="tool-badge"]');
    await expect(toolBadges).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'calculator' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'string-transform' })).toBeVisible();

    // Verify approval-agent tools
    await page.goto('/agents/approval-agent/chat/new');
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    // Should show exactly one tool: needs-approval
    const approvalToolBadges = page.locator('[data-testid="tool-badge"]');
    await expect(approvalToolBadges).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'needs-approval' })).toBeVisible();
  });
});
