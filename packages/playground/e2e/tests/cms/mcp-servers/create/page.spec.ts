import { test, expect, type Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';
import { uniqueServerName, fillMCPServerFields, getToolSwitch } from '../__utils__/helpers';

async function openCreateDialog(page: Page) {
  await page.goto('/mcps');
  const createButton = page.getByRole('button', { name: 'Create MCP server' });
  await expect(createButton).toBeVisible({ timeout: 15000 });
  await createButton.click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Create MCP Server', level: 1 })).toBeVisible({
    timeout: 5000,
  });
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Dialog Opens', () => {
  test('create button opens side dialog', async ({ page }) => {
    await openCreateDialog(page);

    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Create MCP Server', level: 1 })).toBeVisible();
    await expect(page.locator('#mcp-server-name')).toBeVisible();
    await expect(page.locator('#mcp-server-version')).toBeVisible();
  });

  test('create button only shows when editor is available', async ({ page }) => {
    await page.goto('/mcps');
    const createButton = page.getByRole('button', { name: 'Create MCP server' });
    await expect(createButton).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Validation', () => {
  test('shows error toast when submitting empty form', async ({ page }) => {
    await openCreateDialog(page);

    // Clear the name field (should be empty by default, but clear to be safe)
    const nameInput = page.locator('#mcp-server-name');
    await nameInput.clear();

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Please fill in all required fields')).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error when name is empty', async ({ page }) => {
    await openCreateDialog(page);

    const nameInput = page.locator('#mcp-server-name');
    await nameInput.clear();

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Name is required')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Creation with Tools', () => {
  test('creates MCP server with name and version', async ({ page }) => {
    await openCreateDialog(page);

    const serverName = uniqueServerName('Basic');
    await fillMCPServerFields(page, { name: serverName, version: '2.0.0' });

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });
  });

  test('creates MCP server with tool selection', async ({ page }) => {
    await openCreateDialog(page);

    const serverName = uniqueServerName('With Tools');
    await fillMCPServerFields(page, { name: serverName });

    // Wait for tools to load and toggle weatherInfo
    await expect(page.getByText('Available Tools')).toBeVisible({ timeout: 10000 });

    await getToolSwitch(page, 'weatherInfo').click();

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Error Handling', () => {
  test('shows error toast on creation failure', async ({ page }) => {
    await page.route('**/stored/mcp-servers', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    await openCreateDialog(page);

    await fillMCPServerFields(page, { name: uniqueServerName('Error Test') });

    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByText('Failed to create MCP server')).toBeVisible({ timeout: 10000 });

    // Dialog should stay open
    await expect(page.locator('#mcp-server-name')).toBeVisible();
  });
});

/**
 * FEATURE: Create → List → Detail Flow
 * USER STORY: As a user, I want to create an MCP server and see it in the list and detail pages
 * BEHAVIOR UNDER TEST: Created MCP servers persist and display correctly across views
 */
test.describe('Create → List → Detail Flow', () => {
  test('created MCP server appears in list after creation', async ({ page }) => {
    // ARRANGE & ACT: Create a server
    await openCreateDialog(page);
    const serverName = uniqueServerName('ListTest');
    await fillMCPServerFields(page, { name: serverName, version: '1.0.0' });
    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for success
    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Server appears in the list
    await page.goto('/mcps');
    await expect(page.getByRole('link', { name: serverName })).toBeVisible({ timeout: 10000 });
  });

  test('created MCP server with tools shows correct tool count in list', async ({ page }) => {
    // ARRANGE & ACT: Create a server with weatherInfo tool
    await openCreateDialog(page);
    const serverName = uniqueServerName('ToolCount');
    await fillMCPServerFields(page, { name: serverName });

    // Wait for tools to load and toggle weatherInfo
    await expect(page.getByText('Available Tools')).toBeVisible({ timeout: 10000 });
    await getToolSwitch(page, 'weatherInfo').click();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Navigate to list and verify tool count badge
    await page.goto('/mcps');
    await expect(page.getByRole('link', { name: serverName })).toBeVisible({ timeout: 10000 });

    // Find the row with our server and check for tool badge
    const serverRow = page.locator('tr').filter({ hasText: serverName });
    await expect(serverRow.getByText(/1 tool/)).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to created server detail page from list', async ({ page }) => {
    // ARRANGE: Create a server
    await openCreateDialog(page);
    const serverName = uniqueServerName('NavDetail');
    await fillMCPServerFields(page, { name: serverName, version: '2.5.0' });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });

    // ACT: Navigate to list and click on the server
    await page.goto('/mcps');
    await page.getByRole('link', { name: serverName }).click();

    // ASSERT: Detail page shows correct name and version
    await expect(page.locator('h1').filter({ hasText: serverName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('2.5.0')).toBeVisible({ timeout: 5000 });
  });

  test('detail page shows tools selected during creation', async ({ page }) => {
    // ARRANGE & ACT: Create a server with weatherInfo tool selected
    await openCreateDialog(page);
    const serverName = uniqueServerName('ToolDetail');
    await fillMCPServerFields(page, { name: serverName });

    // Wait for tools to load and toggle weatherInfo
    await expect(page.getByText('Available Tools')).toBeVisible({ timeout: 10000 });
    await getToolSwitch(page, 'weatherInfo').click();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Navigate to detail and verify tool appears
    await page.goto('/mcps');
    await page.getByRole('link', { name: serverName }).click();

    // Wait for detail page to load and check for tool in the Available Tools section
    await expect(page.locator('h1').filter({ hasText: serverName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Available Tools')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
  });

  test('created MCP server persists after page reload', async ({ page }) => {
    // ARRANGE & ACT: Create a server
    await openCreateDialog(page);
    const serverName = uniqueServerName('Persist');
    await fillMCPServerFields(page, { name: serverName, version: '1.0.0' });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('MCP server created successfully')).toBeVisible({ timeout: 10000 });

    // Navigate to list first
    await page.goto('/mcps');
    await expect(page.getByRole('link', { name: serverName })).toBeVisible({ timeout: 10000 });

    // ACT: Reload the page
    await page.reload();

    // ASSERT: Server still appears after reload
    await expect(page.getByRole('link', { name: serverName })).toBeVisible({ timeout: 10000 });
  });
});
