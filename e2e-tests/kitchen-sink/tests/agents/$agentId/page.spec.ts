import { test, expect } from '@playwright/test';

test('overall layout information', async ({ page }) => {
  await page.goto('http://localhost:4111/agents/weatherAgent/chat/1234');

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
      await page.goto('http://localhost:4111/agents/weatherAgent/chat/1234');
      const overview = await page.getByLabel('Overview');
      await expect(overview).toBeVisible();
      await expect(overview).toMatchAriaSnapshot();
    });
  });

  test.describe('model settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('http://localhost:4111/agents/weatherAgent/chat/new');
      await page.click('text=Model settings');
    });

    test('model trigger modes', async ({ page }) => {
      const generateRadio = page.getByLabel('Generate');
      await page.click('text=Model settings');

      await expect(generateRadio).toBeVisible();
      await expect(generateRadio).toHaveAttribute('aria-checked', 'false');
      const streamRadio = page.getByLabel('Stream');
      await expect(streamRadio).toBeVisible();
      await expect(streamRadio).toHaveAttribute('aria-checked', 'true');

      const networkRadio = page.getByLabel('Network');
      await expect(networkRadio).toBeVisible();
    });

    test('verfied persistent model settings', async ({ page }) => {
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
