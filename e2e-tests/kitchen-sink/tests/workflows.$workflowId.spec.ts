import { test, expect } from '@playwright/test';

test('overall layout information', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows/complexWorkflow/graph');

  // Header
  await expect(page).toHaveTitle(/Mastra Playground/);
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
