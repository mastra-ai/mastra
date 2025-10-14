import { test, expect } from '@playwright/test';

test('overall layout information', async ({ page }) => {
  await page.goto('http://localhost:4111/agents/weatherAgent/chat/1234');

  // Header
  await expect(page).toHaveTitle(/Mastra Playground/);
  await expect(page.locator('text=Agents documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/agents/overview',
  );
  const breadcrumb = page.locator('header>nav');
  const agentsCrumb = breadcrumb.locator('li:nth-child(1)>a');
  const separatorCrumb = breadcrumb.locator('li:nth-child(2)');
  const agentCrumb = breadcrumb.locator('li:nth-child(3)>a');

  await expect(agentsCrumb).toHaveText('Agents');
  await expect(agentsCrumb).toHaveAttribute('href', '/agents');
  await expect(separatorCrumb).toHaveRole('separator');
  await expect(agentCrumb).toHaveText('Weather Agent');
  await expect(agentCrumb).toHaveAttribute('href', '/agents/weatherAgent');

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
      await page.goto('http://localhost:4111/agents/weatherAgent/chat/1234');

      const searchProviderInput = await page.locator('input[aria-label="Search providers"]');
      await expect(searchProviderInput).toBeVisible();
      await expect(searchProviderInput).toHaveAttribute('value', 'OpenAI');

      const searchModelInput = await page.locator('input[aria-label="Search models"]');
      await expect(searchModelInput).toBeVisible();
      await expect(searchModelInput).toHaveAttribute('value', 'gpt-4o-mini');

      await expect(page.locator('text=Memory is enabled')).toBeDefined();
      const toolBadge = await page.locator('[data-testid="tool-badge"]');
      await expect(toolBadge).toBeVisible();
      await expect(toolBadge).toHaveText('get-weather');
      expect(toolBadge).toHaveAttribute('href', '/agents/weatherAgent/tools/get-weather');
    });
  });

  test.describe('model settings', () => {
    test('verfied persistent model settings', async ({ page }) => {
      // Arrange
      await page.goto('http://localhost:4111/agents/weatherAgent/chat/new');
      await page.click('text=Model settings');
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
      await page.click('text=Model settings');
      await page.click('text=Advanced Settings');

      // Assert
      await expect(page.getByLabel('Top K')).toHaveValue('9');
      await expect(page.getByLabel('Frequency Penalty')).toHaveValue('0.7');
      await expect(page.getByLabel('Presence Penalty')).toHaveValue('0.6');
      await expect(page.getByLabel('Max Tokens')).toHaveValue('44');
      await expect(page.getByLabel('Max Steps')).toHaveValue('3');
      await expect(page.getByLabel('Max Retries')).toHaveValue('2');
    });

    test('resets the form values when pressing "reset" button', async ({ page }) => {
      // Arrange
      await page.goto('http://localhost:4111/agents/weatherAgent/chat/new');
      await page.click('text=Model settings');
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
      await page.click('text=Reset');

      // Assert
      await expect(page.getByLabel('Top K')).toHaveValue('');
      await expect(page.getByLabel('Frequency Penalty')).toHaveValue('');
      await expect(page.getByLabel('Presence Penalty')).toHaveValue('');
      await expect(page.getByLabel('Max Tokens')).toHaveValue('');
      await expect(page.getByLabel('Max Steps')).toHaveValue('5');
      await expect(page.getByLabel('Max Retries')).toHaveValue('2');
    });
  });
});
