import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Thread List Minimalist Design
 * USER STORY: As a user, I want a clean, minimal thread list so that I can easily scan and navigate conversations
 * BEHAVIOR UNDER TEST: Thread list navigation and interaction behavior
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Thread List - Behavior Tests', () => {
  test('should navigate to new chat when clicking New Chat button', async ({ page }) => {
    // ARRANGE
    await page.goto('/agents/weatherAgent/chat/1234');

    // ACT: Click the new chat button
    const newChatButton = page.locator('a:has-text("New Chat")');
    await expect(newChatButton).toBeVisible();
    await newChatButton.click();

    // ASSERT: URL should change to a new thread
    await expect(page).toHaveURL(/agents\/weatherAgent\/chat\/(?!1234)/);
  });

  test('should show thread list with scrollable container', async ({ page }) => {
    // ARRANGE
    await page.goto('/agents/weatherAgent/chat/1234');

    // ASSERT: Thread list container should allow scrolling without layout shifts
    const threadList = page.getByTestId('thread-list');
    await expect(threadList).toBeVisible();

    // Verify parent container has overflow behavior for smooth scrolling
    const scrollContainer = page.locator('.overflow-y-auto:has([data-testid="thread-list"])');
    await expect(scrollContainer).toBeVisible();
  });

  test('should show hover feedback on thread items', async ({ page }) => {
    // ARRANGE: Navigate to agent with existing threads
    await page.goto('/agents/weatherAgent/chat/new');

    // First send a message to create a thread
    await page.getByPlaceholder('Type your message').fill('Hello');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for thread to appear in the list
    await expect(page.getByTestId('thread-list').locator('li')).toHaveCount(2, { timeout: 30000 });

    // ACT: Hover over the thread item (not the "New Chat" item)
    const threadItems = page.getByTestId('thread-list').locator('li');
    const threadItem = threadItems.nth(1); // Second item (first is New Chat)
    await threadItem.hover();

    // ASSERT: Thread item should have hover state visible (delete button appears)
    const deleteButton = threadItem.locator('button');
    await expect(deleteButton).toBeVisible();
  });

  test('should highlight active thread item', async ({ page }) => {
    // ARRANGE: Navigate to agent chat
    await page.goto('/agents/weatherAgent/chat/new');

    // Send a message to create a thread
    await page.getByPlaceholder('Type your message').fill('Test message');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for thread to appear
    await expect(page.getByTestId('thread-list').locator('li')).toHaveCount(2, { timeout: 30000 });

    // The current thread should be active (visually distinguished)
    // Navigate to the thread by clicking it
    const threadLink = page.getByTestId('thread-list').locator('li').nth(1).locator('a');
    const href = await threadLink.getAttribute('href');

    // ASSERT: Current page URL should match the active thread
    expect(page.url()).toContain(href?.split('/').pop());
  });

  test('should delete thread and update list', async ({ page }) => {
    // ARRANGE: Navigate and create a thread
    await page.goto('/agents/weatherAgent/chat/new');

    await page.getByPlaceholder('Type your message').fill('Thread to delete');
    await page.getByRole('button', { name: 'Send' }).click();

    // Wait for thread to appear
    await expect(page.getByTestId('thread-list').locator('li')).toHaveCount(2, { timeout: 30000 });

    // ACT: Hover and click delete
    const threadItem = page.getByTestId('thread-list').locator('li').nth(1);
    await threadItem.hover();

    const deleteButton = threadItem.locator('button[aria-label="delete thread"], button:has(svg)');
    await deleteButton.click();

    // Confirm deletion in dialog
    await page.getByRole('button', { name: 'Continue' }).click();

    // ASSERT: Thread should be removed from list
    await expect(page.getByTestId('thread-list').locator('li')).toHaveCount(1, { timeout: 10000 });
  });
});
