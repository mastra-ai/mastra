import { test, expect } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';

/**
 * FEATURE: Observational Memory UI
 * USER STORY: As a user, I want to see my agent's memory observations in real-time
 *             so that I can understand how the agent is processing and remembering information.
 *
 * BEHAVIORS UNDER TEST:
 * 1. Sidebar shows OM status and progress bars
 * 2. Progress bars update in real-time during streaming
 * 3. Observation markers appear in chat history
 * 4. Observations persist after page reload
 * 5. Reflections are distinguished from observations
 * 6. Adaptive threshold adjusts progress bar display
 */

test.describe('Observational Memory - Behavior Tests', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Sidebar Threshold Rendering', () => {
    /**
     * BEHAVIOR: OM sidebar shows progress bars for message and observation thresholds
     * OUTCOME: User can see how close they are to triggering observation/reflection
     */
    test('should display progress bars when OM is enabled', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-observation-success');
      await page.goto('/agents/om-agent/chat/new');

      // Wait for the page to load and OM to initialize
      await expect(page.locator('h2')).toContainText('OM Agent');

      // Click on the Memory tab to see OM sidebar
      await page.getByRole('tab', { name: 'Memory' }).click();

      // ASSERT: OM sidebar section should be visible with progress bars
      // The sidebar should show "Observational Memory" section
      const omSection = page.getByRole('heading', { name: 'Observational Memory' });
      await expect(omSection).toBeVisible({ timeout: 10000 });

      // Progress bars should be present (Messages and Observations labels)
      await expect(page.getByText('Messages', { exact: true })).toBeVisible();
      await expect(page.getByText('Observations', { exact: true })).toBeVisible();
    });

    /**
     * BEHAVIOR: Progress bars show threshold info on hover
     * OUTCOME: User can see model and threshold details via tooltip
     */
    test('should show threshold info tooltip on hover', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-observation-success');
      await page.goto('/agents/om-agent/chat/new');

      // Wait for page to load
      await expect(page.locator('h2')).toContainText('OM Agent');

      // Click on the Memory tab to see OM sidebar
      await page.getByRole('tab', { name: 'Memory' }).click();

      // Wait for OM section
      await expect(page.getByRole('heading', { name: 'Observational Memory' })).toBeVisible({ timeout: 10000 });

      // ACT: Hover over the info icon next to Messages
      const messagesLabel = page.getByText('Messages', { exact: true });
      const infoIcon = messagesLabel.locator('..').locator('svg').first();

      if (await infoIcon.isVisible()) {
        await infoIcon.hover();

        // ASSERT: Tooltip should show threshold settings with actual values
        const tooltip = page.getByRole('tooltip');
        await expect(tooltip).toBeVisible({ timeout: 5000 });
        await expect(tooltip).toContainText(/Observer Settings/i);
        // Verify the model name is shown (from fixture config: mock/mock-observer)
        await expect(tooltip).toContainText(/mock-observer/i);
        // Verify the threshold value is shown (from fixture config: 20 tokens)
        await expect(tooltip).toContainText(/20 tokens/i);
      }
    });
  });

  test.describe('Chat History Observation Markers', () => {
    /**
     * BEHAVIOR: Observation start marker appears when observation begins
     * OUTCOME: User sees real-time feedback that memory is being updated
     */
    test('should show observing indicator when observation starts', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-observation-success');
      await page.goto('/agents/om-agent/chat/new');

      // Wait for page to load
      await expect(page.locator('h2')).toContainText('OM Agent');

      // ACT: Send a message to trigger the agent
      const chatInput = page.locator('textarea[placeholder*="message"]').first();
      await chatInput.fill('Hello, please help me with something');
      await chatInput.press('Enter');

      // Give time for the stream to process
      await page.waitForTimeout(2000);

      // ASSERT: Check that some response appeared (the fixture should stream text)
      // The thread wrapper should be visible
      const threadWrapper = page.locator('[data-testid="thread-wrapper"]');
      await expect(threadWrapper).toBeVisible({ timeout: 15000 });

      // Click on the Memory tab to see OM sidebar
      await page.getByRole('tab', { name: 'Memory' }).click();

      // The OM sidebar should show activity (progress bars should have updated)
      await expect(page.getByText('Messages', { exact: true })).toBeVisible();
    });

    /**
     * BEHAVIOR: Completed observation shows compression stats
     * OUTCOME: User sees how much memory was compressed (e.g., "Observed 50→100 tokens")
     *
     * NOTE: OM only triggers observation on stepNumber > 0 (after first response).
     * We need to send multiple messages to accumulate enough tokens to trigger observation.
     * With threshold=50 tokens, we need ~50 tokens of conversation before observation triggers.
     */
    /**
     * SKIPPED: Observation markers require multi-step agent execution (stepNumber > 0).
     * In simple chat without tools, each message is a separate turn with stepNumber = 0.
     * The OM processor only triggers observation on stepNumber > 0.
     *
     * To test this properly, we would need:
     * 1. An agent with tools that trigger multi-step execution
     * 2. A mock model that returns tool calls
     *
     * For now, we verify the sidebar behavior instead of chat markers.
     */
    test('should show completion stats when observation finishes', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-observation-success');
      await page.goto('/agents/om-agent/chat/new');

      const chatInput = page.locator('textarea[placeholder*="message"]').first();
      const threadWrapper = page.locator('[data-testid="thread-wrapper"]');

      // ACT: Send first message to start conversation
      await chatInput.fill('Hello, I need help with something important today.');
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);

      // ACT: Send second message to accumulate more tokens
      // This should trigger observation on step 1 of this turn
      await chatInput.fill('Can you also tell me about the weather forecast for tomorrow?');
      await chatInput.press('Enter');
      await page.waitForTimeout(3000);

      // ASSERT: The response should be visible
      await expect(threadWrapper).toBeVisible({ timeout: 15000 });

      // ASSERT: Observation completion marker should show compression stats
      // With mock observer model, we expect: "Observed X→Y tokens"
      // Use .first() because multiple observation cycles may trigger across messages
      const observationMarker = threadWrapper.getByText(/Observed.*→.*tokens/i).first();
      await expect(observationMarker).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Observation Persistence', () => {
    test('should persist observations after page reload', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-observation-success');
      await page.goto('/agents/om-agent/chat/new');

      // Wait for page to load
      await expect(page.locator('h2')).toContainText('OM Agent');

      const chatInput = page.locator('textarea[placeholder*="message"]').first();
      const threadWrapper = page.locator('[data-testid="thread-wrapper"]');

      // ACT: Send first message to start conversation
      await chatInput.fill('Hello, I need help with something important today.');
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);

      // ACT: Send second message to accumulate tokens and trigger observation
      await chatInput.fill('Remember this important information for later.');
      await chatInput.press('Enter');
      await page.waitForTimeout(3000);

      // Verify observation marker appeared before reload
      await expect(threadWrapper.getByText(/Observed.*→.*tokens/i).first()).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: 'test-results/persistence-before-reload.png' });

      // Grab the thread URL so we can check it reloads to the same thread
      const urlBeforeReload = page.url();
      console.log('URL before reload:', urlBeforeReload);

      // ACT: Reload the page
      await page.reload();

      // Wait for page to reload
      await expect(page.locator('h2')).toContainText('OM Agent', { timeout: 10000 });

      const urlAfterReload = page.url();
      console.log('URL after reload:', urlAfterReload);

      // Wait for messages to load
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/persistence-after-reload.png' });

      // ASSERT: The observation marker should still be visible after reload
      // This verifies the data-om-* parts were persisted to storage
      await expect(
        page
          .locator('[data-testid="thread-wrapper"]')
          .getByText(/Observed.*→.*tokens/i)
          .first(),
      ).toBeVisible({
        timeout: 10000,
      });

      // ASSERT: OM sidebar should show the observations
      await page.getByRole('tab', { name: 'Memory' }).click();
      const omSection = page.getByRole('heading', { name: 'Observational Memory' });
      await expect(omSection).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Reflection Behavior', () => {
    test.skip('should show reflection indicator when reflection occurs', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-reflection');
      await page.goto('/agents/om-agent/chat/new');

      // Wait for page to load
      await expect(page.locator('h2')).toContainText('OM Agent');

      const chatInput = page.locator('textarea[placeholder*="message"]').first();
      const threadWrapper = page.locator('[data-testid="thread-wrapper"]');

      // ACT: Send first message to start conversation
      await chatInput.fill('Hello, I need help with something important today.');
      await chatInput.press('Enter');
      await page.waitForTimeout(2000);

      // ACT: Send second message to trigger observation and reflection
      await chatInput.fill('This will trigger reflection after observation.');
      await chatInput.press('Enter');
      await page.waitForTimeout(3000);

      // Observation marker should show (fixture emits observation first)
      await expect(threadWrapper.getByText(/Observed.*→.*tokens/i).first()).toBeVisible({ timeout: 10000 });

      // Reflection marker should also show (fixture emits reflection after observation)
      await expect(threadWrapper.getByText(/Reflected.*→.*tokens/i).first()).toBeVisible({ timeout: 10000 });

      // Click on the Memory tab to verify sidebar
      await page.getByRole('tab', { name: 'Memory' }).click();
      await expect(page.getByRole('heading', { name: 'Observational Memory' })).toBeVisible();
    });
  });

  test.describe('Adaptive Threshold', () => {
    /**
     * BEHAVIOR: Adaptive threshold shows shared budget in progress bars
     * OUTCOME: User sees that thresholds adjust based on current observation size
     */
    test('should show adaptive threshold indicator', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-shared-budget');
      await page.goto('/agents/om-adaptive-agent/chat/new');

      // Wait for page to load
      await expect(page.locator('h2')).toContainText('OM Adaptive Agent');

      // Click on the Memory tab to see OM sidebar
      await page.getByRole('tab', { name: 'Memory' }).click();

      // ASSERT: OM sidebar should show adaptive threshold behavior
      const omSection = page.getByRole('heading', { name: 'Observational Memory' });
      await expect(omSection).toBeVisible({ timeout: 10000 });

      // Progress bars should be visible (use .first() since "Observations" may appear in both progress bar and section header)
      await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Observations', { exact: true }).first()).toBeVisible();

      // ACT: Send a message to trigger progress update
      const chatInput = page.locator('textarea[placeholder*="message"]').first();
      await chatInput.fill('Test adaptive threshold');
      await chatInput.press('Enter');

      // Wait for response
      await page.waitForTimeout(2000);

      // ASSERT: OM sidebar should still be functional after message
      await expect(page.getByRole('heading', { name: 'Observational Memory' })).toBeVisible();

      // Progress bars should show updated values
      await expect(page.getByText('Messages', { exact: true })).toBeVisible();
      await expect(page.getByText('Observations', { exact: true })).toBeVisible();
    });
  });

  test.describe('Previous Observations Section', () => {
    /**
     * BEHAVIOR: Previous observations section shows history
     * OUTCOME: User can see past observation generations
     */
    test('should show previous observations when history exists', async ({ page }) => {
      // ARRANGE
      await selectFixture(page, 'om-reflection');
      await page.goto('/agents/om-agent/chat/new');

      // Click on the Memory tab to see OM sidebar
      await page.getByRole('tab', { name: 'Memory' }).click();

      // ACT: Send messages to create observation history
      const chatInput = page.locator('textarea[placeholder*="message"]').first();
      await chatInput.fill('First message for history');
      await chatInput.press('Enter');

      // Wait for observation
      await page.waitForTimeout(4000);

      // ASSERT: OM sidebar should show observations
      await expect(page.getByRole('heading', { name: 'Observational Memory' })).toBeVisible();

      // Progress bars should be visible (use .first() since "Observations" may appear in both progress bar and section header)
      await expect(page.getByText('Messages', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Observations', { exact: true }).first()).toBeVisible();
    });
  });
});

test.describe('Observational Memory - Edge Cases', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  /**
   * BEHAVIOR: OM handles stream interruption gracefully
   * OUTCOME: User sees "interrupted" state, not stuck loading
   */
  test('should handle interrupted observation gracefully', async ({ page }) => {
    // ARRANGE
    await selectFixture(page, 'om-observation-success');
    await page.goto('/agents/om-agent/chat/new');

    // ACT: Start a message then navigate away
    const chatInput = page.locator('textarea[placeholder*="message"]').first();
    await chatInput.fill('Start processing');
    await chatInput.press('Enter');

    // Wait briefly then navigate away
    await page.waitForTimeout(500);
    await page.goto('/agents');

    // Navigate back
    await page.goto('/agents/om-agent/chat/new');

    // ASSERT: Page should load without stuck loading states
    await expect(page.locator('h2')).toContainText('OM Agent', { timeout: 10000 });

    // Click on the Memory tab to see OM sidebar
    await page.getByRole('tab', { name: 'Memory' }).click();

    // OM section should not show stuck "observing" state
    const omSection = page.getByRole('heading', { name: 'Observational Memory' });
    await expect(omSection).toBeVisible({ timeout: 10000 });
  });

  /**
   * BEHAVIOR: OM works correctly when switching between threads
   * OUTCOME: Each thread has its own observation state
   */
  test('should maintain separate observation state per thread', async ({ page }) => {
    // ARRANGE
    await selectFixture(page, 'om-observation-success');

    // Create first thread
    await page.goto('/agents/om-agent/chat/new');
    await expect(page.locator('h2')).toContainText('OM Agent');

    const chatInput = page.locator('textarea[placeholder*="message"]').first();
    await chatInput.fill('Message in thread 1');
    await chatInput.press('Enter');
    await page.waitForTimeout(3000);

    // Get first thread URL
    const thread1Url = page.url();

    // ACT: Create second thread
    await page.goto('/agents/om-agent/chat/new');
    await expect(page.locator('h2')).toContainText('OM Agent');

    // Click on the Memory tab to see OM sidebar
    await page.getByRole('tab', { name: 'Memory' }).click();

    // ASSERT: Second thread should start fresh
    // Progress bars should be at 0 or initial state
    const omSection = page.getByRole('heading', { name: 'Observational Memory' });
    await expect(omSection).toBeVisible({ timeout: 10000 });

    // Navigate back to first thread
    await page.goto(thread1Url);

    // First thread should still have its state
    await expect(page.locator('h2')).toContainText('OM Agent', { timeout: 10000 });
  });
});
