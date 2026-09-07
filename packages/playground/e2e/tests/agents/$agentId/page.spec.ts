import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

test.describe('Agent detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an agent chat page is visited', () => {
    test('renders the layout, thread history, and links through to agent settings', async ({ page }) => {
      await page.goto('/agents/weather-agent/chat/1234');

      await expect(page).toHaveTitle(/Mastra Studio/);

      // Thread sidebar
      const newChatButton = page.locator('a:has-text("New Chat")');
      await expect(newChatButton).toBeVisible();
      await expect(newChatButton).toHaveAttribute('href', /agents\/weather-agent\/threads\/.*/);
      await expect(page.getByTestId('thread-list')).toBeAttached();

      // Back link leads to the agent overview with its settings details
      const backLink = page.getByRole('link', { name: 'Back to Weather Agent' });
      await expect(backLink).toHaveAttribute('href', /\/agents\/weather-agent\/overview$/);
      await backLink.click();
      await expect(page).toHaveURL(/\/agents\/weather-agent\/overview$/);
      await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: /^Tools/ })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: 'weatherInfo' })).toHaveAttribute(
        'href',
        /\/agents\/weather-agent\/tools\/weatherInfo$/,
      );
    });
  });

  test.describe('when the agent settings page is visited', () => {
    test('shows the general overview tab selected with its details', async ({ page }) => {
      await page.goto('/agents/weather-agent/settings');

      await expect(page.getByTestId('agent-settings-view')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

      const overview = page.getByTestId('agent-settings-view');
      await expect(overview).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Capabilities' })).toBeVisible();
      await expect(overview).toMatchAriaSnapshot();
    });
  });

  test.describe('when the composer model settings popover is opened', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/agents/weather-agent/chat/new');
      await page.getByTestId('composer-model-settings-trigger').click();
    });

    test('shows the available model trigger modes with stream subscription as default', async ({ page }) => {
      const generateRadio = page.getByRole('radio', { name: 'Generate' });

      await expect(generateRadio).toBeVisible();
      await expect(generateRadio).toHaveAttribute('aria-checked', 'false');
      const streamSubscriptionRadio = page.getByRole('radio', { name: 'Stream subscription (default)' });
      await expect(streamSubscriptionRadio).toBeVisible();
      await expect(streamSubscriptionRadio).toHaveAttribute('aria-checked', 'true');

      const streamRadio = page.getByRole('radio', { name: 'Stream', exact: true });
      await expect(streamRadio).toBeVisible();
      await expect(streamRadio).toHaveAttribute('aria-checked', 'false');

      const networkRadio = page.getByRole('radio', { name: 'Network' });
      await expect(networkRadio).toBeVisible();
    });

    test('persists model settings across a reload', async ({ page }) => {
      // Arrange
      await page.isVisible('text=Chat Method');
      await page.click('text=Generate');
      await page.click('text=Advanced Settings');
      await page.getByLabel('Top K').fill('9');
      await page.getByLabel('Frequency Penalty').fill('0.7');
      await page.getByLabel('Presence Penalty').fill('0.6');
      await page.getByLabel('Max Tokens').fill('44');
      await page.getByLabel('Max Steps').fill('3');
      await page.getByLabel('Max Retries').fill('2');

      // Act
      await page.reload();
      await page.getByTestId('composer-model-settings-trigger').click();
      await page.click('text=Advanced Settings');

      // Assert
      await expect(page.getByLabel('Top K')).toHaveValue('9');
      await expect(page.getByLabel('Frequency Penalty')).toHaveValue('0.7');
      await expect(page.getByLabel('Presence Penalty')).toHaveValue('0.6');
      await expect(page.getByLabel('Max Tokens')).toHaveValue('44');
      await expect(page.getByLabel('Max Steps')).toHaveValue('3');
      await expect(page.getByLabel('Max Retries')).toHaveValue('2');
    });

    test('resets the form values when pressing the "reset" button', async ({ page }) => {
      // Arrange
      await page.isVisible('text=Chat Method');
      await page.click('text=Generate');
      await page.click('text=Advanced Settings');
      await page.getByLabel('Top K').fill('9');
      await page.getByLabel('Frequency Penalty').fill('0.7');
      await page.getByLabel('Presence Penalty').fill('0.6');
      await page.getByLabel('Max Tokens').fill('44');
      await page.getByLabel('Max Steps').fill('3');
      await page.getByLabel('Max Retries').fill('2');

      // Close the Advanced Settings dialog before clicking Reset (Reset lives in the composer popover)
      await page.keyboard.press('Escape');

      // Act
      await page.click('text=Reset');

      // Reopen Advanced Settings to inspect the reset field values
      await page.click('text=Advanced Settings');

      // Assert - values reset to defaults (maxSteps: 15, maxRetries: 2 are fallback defaults)
      await expect(page.getByLabel('Top K')).toHaveValue('');
      await expect(page.getByLabel('Frequency Penalty')).toHaveValue('');
      await expect(page.getByLabel('Presence Penalty')).toHaveValue('');
      await expect(page.getByLabel('Max Tokens')).toHaveValue('');
      await expect(page.getByLabel('Max Steps')).toHaveValue('15');
      await expect(page.getByLabel('Max Retries')).toHaveValue('2');
    });
  });
});
