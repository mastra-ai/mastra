import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Dedicated agent session page (minimal UI)
 * USER STORY: As a user, I want a minimal session page for quick testing without the full studio chrome.
 * BEHAVIOR UNDER TEST: The session page renders only the chat interface without sidebar and info pane.
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('session page - layout', () => {
  test('renders chat interface without sidebar and info pane', async ({ page }) => {
    await page.goto('/agents/weather-agent/session/1234');

    // ASSERT: Page loads with correct title
    await expect(page).toHaveTitle(/Mastra Studio/);

    // ASSERT: Header with Mastra logo and studio title is visible
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header').locator('svg')).toBeVisible();
    await expect(page.locator('header').locator('text=Mastra Studio')).toBeVisible();

    // ASSERT: Chat composer is visible (the message input area)
    await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();

    // ASSERT: Left sidebar (thread list with "New Chat" button) is NOT present
    await expect(page.locator('a:has-text("New Chat")')).not.toBeVisible();

    // ASSERT: Right info pane (agent information with Overview/Model Settings tabs) is NOT present
    await expect(page.locator('button:has-text("Overview")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Model Settings")')).not.toBeVisible();

    // ASSERT: Main app sidebar navigation is NOT present
    await expect(page.locator('nav:has-text("Agents")')).not.toBeVisible();

    // ASSERT: Model switcher (provider/model comboboxes) is NOT present
    await expect(page.getByRole('combobox')).not.toBeVisible();
  });

  test('does not render preset dropdown when no presets are configured', async ({ page }) => {
    await page.goto('/agents/weather-agent/session/1234');

    // ASSERT: No preset selector dropdown should be visible (since no presets are set by default)
    await expect(page.locator('text=Select a preset')).not.toBeVisible();
  });
});
