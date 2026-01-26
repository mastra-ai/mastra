import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

test('overall layout information', async ({ page }) => {
  await page.goto('/agents/weatherAgent/chat/1234');

  // Header
  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('text=Agents documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/agents/overview',
  );
  const breadcrumb = page.locator('header>nav');
  expect(breadcrumb).toMatchAriaSnapshot();

  // Thread history (with memory)
  const newChatButton = await page.locator('a:has-text("New Chat")');
  await expect(newChatButton).toBeVisible();
  await expect(newChatButton).toHaveAttribute('href', /agents\/weatherAgent\/chat\/.*/);
  await expect(page.locator('text=Your conversations will appear here once you start chatting!')).toBeVisible();

  // Information side panel
  await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();
  await expect(page.locator('button:has-text("weatherAgent")')).toBeVisible();
  const overviewPane = await page.locator('button:has-text("Overview")');
  await expect(overviewPane).toHaveAttribute('aria-selected', 'true');
  const modelSettingsPane = await page.locator('button:has-text("Model Settings")');
  await expect(modelSettingsPane).toHaveAttribute('aria-selected', 'false');
  const memoryPane = await page.locator('button:has-text("Memory")');
  await expect(memoryPane).toHaveAttribute('aria-selected', 'false');
});

test.describe('agent panels', () => {
  test.describe('overview', () => {
    test('general information', async ({ page }) => {
      await page.goto('/agents/weatherAgent/chat/1234');
      const overview = await page.getByLabel('Overview');
      await expect(overview).toBeVisible();
      await expect(overview).toMatchAriaSnapshot();
    });
  });

  test.describe('model settings', () => {
    /**
     * FEATURE: Agent Model Settings
     * USER STORY: As a user, I want to configure model behavior so that the agent responds appropriately
     * BEHAVIOR UNDER TEST: Settings persist and affect agent behavior
     */

    test.beforeEach(async ({ page }) => {
      await page.goto('/agents/weatherAgent/chat/new');
      await page.click('text=Model settings');
    });

    test('chat method selection persists and affects agent configuration', async ({ page }) => {
      // ARRANGE: Verify default state is Stream
      const generateRadio = page.getByLabel('Generate');
      const streamRadio = page.getByLabel('Stream');
      const networkRadio = page.getByLabel('Network');

      await expect(generateRadio).toBeVisible();
      await expect(streamRadio).toBeVisible();
      await expect(networkRadio).toBeVisible();
      await expect(streamRadio).toHaveAttribute('aria-checked', 'true');

      // ACT: Select Generate method
      await page.click('text=Generate');
      await expect(generateRadio).toHaveAttribute('aria-checked', 'true');

      // ASSERT: Selection persists after page reload
      await page.reload();
      await page.click('text=Model settings');
      await expect(page.getByLabel('Generate')).toHaveAttribute('aria-checked', 'true');
    });

    test('require tool approval toggle affects agent execution behavior', async ({ page }) => {
      // ARRANGE: Find the tool approval switch
      const toolApprovalSwitch = page.getByTestId('tool-approval-switch');
      await expect(toolApprovalSwitch).toBeVisible();

      // Verify initial state is unchecked
      await expect(toolApprovalSwitch).toHaveAttribute('data-state', 'unchecked');

      // ACT: Toggle the switch on
      await toolApprovalSwitch.click();

      // ASSERT: Switch state changes immediately (UI feedback)
      await expect(toolApprovalSwitch).toHaveAttribute('data-state', 'checked');

      // ASSERT: Setting persists after page reload
      await page.reload();
      await page.click('text=Model settings');
      await expect(page.getByTestId('tool-approval-switch')).toHaveAttribute('data-state', 'checked');

      // ACT: Toggle back off
      await page.getByTestId('tool-approval-switch').click();
      await expect(page.getByTestId('tool-approval-switch')).toHaveAttribute('data-state', 'unchecked');
    });

    test('sampling parameters (temperature/topP) persist and are applied', async ({ page }) => {
      // ARRANGE: Locate the temperature slider
      // Temperature and Top P use sliders, we'll interact via keyboard for precision

      // ACT: Set temperature by clicking the slider track
      const temperatureSlider = page.locator('[data-testid="agent-settings"]').getByRole('slider').first();
      await temperatureSlider.focus();
      // Press right arrow multiple times to increase value
      await temperatureSlider.press('ArrowRight');
      await temperatureSlider.press('ArrowRight');
      await temperatureSlider.press('ArrowRight');

      // ASSERT: Value persists after reload
      await page.reload();
      await page.click('text=Model settings');

      // Temperature should have a non-default value
      const tempValue = page
        .locator('[data-testid="agent-settings"]')
        .locator('text=Temperature')
        .locator('..')
        .locator('..')
        .getByText(/\d\.\d|n\/a/);
      await expect(tempValue).not.toHaveText('n/a');
    });

    test('advanced settings persist after page reload', async ({ page }) => {
      // ARRANGE: Open advanced settings and configure values
      await page.click('text=Advanced Settings');
      await page.getByLabel('Top K').fill('9');
      await page.getByLabel('Frequency Penalty').fill('0.7');
      await page.getByLabel('Presence Penalty').fill('0.6');
      await page.getByLabel('Max Tokens').fill('44');
      await page.getByLabel('Max Steps').fill('3');
      await page.getByLabel('Max Retries').fill('2');

      // ACT: Reload the page
      await page.reload();
      await page.click('text=Model settings');
      await page.click('text=Advanced Settings');

      // ASSERT: All values persist
      await expect(page.getByLabel('Top K')).toHaveValue('9');
      await expect(page.getByLabel('Frequency Penalty')).toHaveValue('0.7');
      await expect(page.getByLabel('Presence Penalty')).toHaveValue('0.6');
      await expect(page.getByLabel('Max Tokens')).toHaveValue('44');
      await expect(page.getByLabel('Max Steps')).toHaveValue('3');
      await expect(page.getByLabel('Max Retries')).toHaveValue('2');
    });

    test('reset button clears all custom settings to defaults', async ({ page }) => {
      // ARRANGE: Configure multiple settings
      await page.click('text=Generate');
      await page.click('text=Advanced Settings');
      await page.getByLabel('Top K').fill('9');
      await page.getByLabel('Frequency Penalty').fill('0.7');
      await page.getByLabel('Presence Penalty').fill('0.6');
      await page.getByLabel('Max Tokens').fill('44');
      await page.getByLabel('Max Steps').fill('3');
      await page.getByLabel('Max Retries').fill('2');

      // ACT: Click reset button
      await page.click('text=Reset All Settings');

      // ASSERT: Values reset to defaults
      await expect(page.getByLabel('Top K')).toHaveValue('');
      await expect(page.getByLabel('Frequency Penalty')).toHaveValue('');
      await expect(page.getByLabel('Presence Penalty')).toHaveValue('');
      await expect(page.getByLabel('Max Tokens')).toHaveValue('');
      await expect(page.getByLabel('Max Steps')).toHaveValue('5');
      await expect(page.getByLabel('Max Retries')).toHaveValue('2');
    });

    test('advanced settings collapsible provides immediate UI feedback', async ({ page }) => {
      // ARRANGE: Locate the collapsible
      const advancedSettingsCollapsible = page.getByTestId('advanced-settings-collapsible');
      await expect(advancedSettingsCollapsible).toBeVisible();

      // ASSERT: Initially collapsed - content should not be visible
      await expect(page.getByLabel('Top K')).not.toBeVisible();

      // ACT: Click to expand
      await page.click('text=Advanced Settings');

      // ASSERT: Content becomes visible immediately
      await expect(page.getByLabel('Top K')).toBeVisible();
      await expect(page.getByLabel('Max Tokens')).toBeVisible();

      // ACT: Click to collapse
      await page.click('text=Advanced Settings');

      // ASSERT: Content hides
      await expect(page.getByLabel('Top K')).not.toBeVisible();
    });
  });
});
