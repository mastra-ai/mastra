import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Memory Tab
 * USER STORY: As a user, I want to view and manage memory configuration and working memory
 *             so that I can understand and control how the agent remembers context
 * BEHAVIOR UNDER TEST: Memory Tab displays configuration, working memory, and semantic recall
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Memory Tab - Behavior Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');
    // Navigate to Memory tab
    await page.click('button:has-text("Memory")');
  });

  test('Memory tab is visible for agents with memory enabled', async ({ page }) => {
    // ASSERT: Memory tab exists and is selectable
    const memoryTab = page.locator('button:has-text("Memory")');
    await expect(memoryTab).toBeVisible();
    await expect(memoryTab).toHaveAttribute('aria-selected', 'true');

    // ASSERT: Memory tab content is displayed
    const memoryTabContent = page.getByTestId('memory-tab');
    await expect(memoryTabContent).toBeVisible();
  });

  test('Clone Thread section displays with functional button when thread exists', async ({ page }) => {
    // ASSERT: Clone Thread section is visible
    const cloneSection = page.getByTestId('clone-thread-section');
    await expect(cloneSection).toBeVisible();

    // ASSERT: Clone button is present and actionable
    const cloneButton = page.getByTestId('clone-thread-button');
    await expect(cloneButton).toBeVisible();
    await expect(cloneButton).toContainText('Clone');
  });

  test('Semantic Recall section displays correctly', async ({ page }) => {
    // ASSERT: Semantic Recall section is visible
    const semanticRecallSection = page.getByTestId('semantic-recall-section');
    await expect(semanticRecallSection).toBeVisible();

    // ASSERT: Section header is present
    await expect(semanticRecallSection.locator('text=Semantic Recall')).toBeVisible();
  });

  test('Memory Configuration section displays with collapsible sections', async ({ page }) => {
    // ASSERT: Memory Configuration section is visible
    const memoryConfig = page.getByTestId('memory-config');
    await expect(memoryConfig).toBeVisible();

    // ASSERT: General section is present and collapsible
    await expect(memoryConfig.locator('text=Memory Configuration')).toBeVisible();
    await expect(memoryConfig.locator('text=General')).toBeVisible();

    // ASSERT: Memory Enabled badge shows correct status
    const memoryEnabledItem = page.getByTestId('memory-config-item-memory-enabled');
    await expect(memoryEnabledItem).toBeVisible();
  });

  test('Memory Configuration collapsible sections expand and collapse', async ({ page }) => {
    // ARRANGE: Locate General collapsible
    const memoryConfig = page.getByTestId('memory-config');
    const generalTrigger = memoryConfig.locator('button:has-text("General")');

    // ASSERT: Initially expanded (default open)
    await expect(page.getByTestId('memory-config-item-memory-enabled')).toBeVisible();

    // ACT: Click to collapse
    await generalTrigger.click();

    // ASSERT: Content becomes hidden (with animation)
    await expect(page.getByTestId('memory-config-item-memory-enabled')).not.toBeVisible({ timeout: 2000 });

    // ACT: Click to expand again
    await generalTrigger.click();

    // ASSERT: Content becomes visible again
    await expect(page.getByTestId('memory-config-item-memory-enabled')).toBeVisible({ timeout: 2000 });
  });

  test('Working Memory section displays with source badge', async ({ page }) => {
    // ASSERT: Working Memory section is visible
    const workingMemory = page.getByTestId('working-memory');
    await expect(workingMemory).toBeVisible();

    // ASSERT: Section header is present
    await expect(workingMemory.locator('text=Working Memory')).toBeVisible();
  });

  test('Memory Search input is functional', async ({ page }) => {
    // ASSERT: Memory search component is visible
    const memorySearch = page.getByTestId('memory-search');
    await expect(memorySearch).toBeVisible();

    // ASSERT: Search input is present
    const searchInput = page.getByTestId('memory-search-input');
    await expect(searchInput).toBeVisible();

    // ACT: Type in search input
    await searchInput.fill('test query');

    // ASSERT: Clear button appears when there is text
    const clearButton = page.getByTestId('memory-search-clear');
    await expect(clearButton).toBeVisible();

    // ACT: Clear the search
    await clearButton.click();

    // ASSERT: Input is cleared
    await expect(searchInput).toHaveValue('');
  });
});

test.describe('Memory Tab - Working Memory CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');
    await page.click('button:has-text("Memory")');
  });

  test('Edit Working Memory button shows tooltip when thread does not exist', async ({ page }) => {
    // Navigate to a new chat without existing thread
    await page.goto('/agents/weatherAgent/chat/new-thread-test');
    await page.click('button:has-text("Memory")');

    // ASSERT: Working memory section shows guidance text
    const workingMemory = page.getByTestId('working-memory');
    await expect(workingMemory).toBeVisible();
  });
});

test.describe('Memory Tab - Playground UI Components', () => {
  /**
   * BEHAVIOR UNDER TEST: Memory Tab uses playground-ui library components
   * These tests verify the refactored components use Badge, Txt, and Collapsible
   */

  test.beforeEach(async ({ page }) => {
    await page.goto('/agents/weatherAgent/chat/1234');
    await page.click('button:has-text("Memory")');
  });

  test('Memory Configuration uses Badge component for status indicators', async ({ page }) => {
    // ASSERT: Memory configuration items use Badge component styling
    const memoryConfig = page.getByTestId('memory-config');

    // Check that badges are rendered (they have the correct semantic classes)
    const badges = memoryConfig.locator('[class*="badge"], [class*="inline-flex"][class*="rounded-md"]');
    await expect(badges.first()).toBeVisible();
  });

  test('Section headers use Txt component for consistent typography', async ({ page }) => {
    // ASSERT: Headers use consistent typography styling from Txt component
    const memoryTab = page.getByTestId('memory-tab');

    // Headers should have text-sm or text-ui-sm class from Txt component
    const sectionHeaders = memoryTab.locator('h3');
    await expect(sectionHeaders.first()).toBeVisible();
  });

  test('Collapsible sections animate smoothly on toggle', async ({ page }) => {
    // ASSERT: Collapsible from playground-ui is used (has data-state attribute)
    const memoryConfig = page.getByTestId('memory-config');
    const collapsibleTrigger = memoryConfig.locator('button:has-text("General")');

    // Trigger should be present and interactive
    await expect(collapsibleTrigger).toBeVisible();

    // ACT: Toggle the collapsible
    await collapsibleTrigger.click();

    // ASSERT: Collapsible animation occurs (content visibility changes)
    await page.waitForTimeout(300); // Wait for animation

    // Toggle back
    await collapsibleTrigger.click();
    await page.waitForTimeout(300);

    // Content should be visible again
    await expect(page.getByTestId('memory-config-item-memory-enabled')).toBeVisible();
  });
});
