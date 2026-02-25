import { test, expect, type Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';
import { uniqueServerName, createMCPServerViaAPI, getToolSwitch } from '../__utils__/helpers';

const PORT = process.env.E2E_PORT || '4111';
const BASE_URL = `http://localhost:${PORT}`;

async function navigateToServerDetail(page: Page, serverName: string) {
  await page.goto('/mcps');
  await page.getByRole('link', { name: serverName }).click();
  await expect(page.locator('h1').filter({ hasText: serverName })).toBeVisible({ timeout: 10000 });
}

async function openEditDialog(page: Page) {
  const editButton = page.getByRole('button', { name: 'Edit' });
  await expect(editButton).toBeVisible({ timeout: 5000 });
  await editButton.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Pre-populates Form', () => {
  test('pre-populates name and version from existing server', async () => {
    const serverName = uniqueServerName('Prepopulate');
    const server = await createMCPServerViaAPI({
      name: serverName,
      version: '3.0.0',
      tools: { weatherInfo: { description: 'Get weather info' } },
    });

    // Navigate to mcps page and open edit dialog
    // For now, we verify via API that the server was created correctly
    const detailRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}?status=draft`);
    const detail = await detailRes.json();

    expect(detail.name).toBe(serverName);
    expect(detail.version).toBe('3.0.0');
    expect(detail.tools).toHaveProperty('weatherInfo');
  });
});

test.describe('Update Persists', () => {
  test('update via API persists changes', async () => {
    const serverName = uniqueServerName('Update');
    const server = await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: { weatherInfo: { description: 'Weather tool' } },
    });

    // Update the server
    const updateRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${serverName} Updated`,
        version: '2.0.0',
      }),
    });

    expect(updateRes.ok).toBe(true);

    // Verify the update persisted
    const detailRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}?status=draft`);
    const detail = await detailRes.json();

    expect(detail.name).toBe(`${serverName} Updated`);
    expect(detail.version).toBe('2.0.0');
    expect(detail.tools).toHaveProperty('weatherInfo');
  });
});

test.describe('Partial Update', () => {
  test('partial update only changes specified fields', async () => {
    const serverName = uniqueServerName('Partial');
    const server = await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: {
        weatherInfo: { description: 'Weather tool' },
        simpleMcpTool: { description: 'Simple tool' },
      },
    });

    // Only update the version
    const updateRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: '1.1.0' }),
    });

    expect(updateRes.ok).toBe(true);

    const detailRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}?status=draft`);
    const detail = await detailRes.json();

    expect(detail.name).toBe(serverName);
    expect(detail.version).toBe('1.1.0');
    expect(detail.tools).toHaveProperty('weatherInfo');
    expect(detail.tools).toHaveProperty('simpleMcpTool');
  });
});

test.describe('Error Handling', () => {
  test('returns 404 for non-existent server update', async () => {
    const updateRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/non-existent-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });

    expect(updateRes.status).toBe(404);
  });

  test('returns 409 for duplicate server creation', async () => {
    const serverName = uniqueServerName('Duplicate');
    await createMCPServerViaAPI({ name: serverName, version: '1.0.0' });

    const res = await fetch(`${BASE_URL}/api/stored/mcp-servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: serverName, version: '1.0.0' }),
    });

    expect(res.status).toBe(409);
  });
});

test.describe('Delete', () => {
  test('deletes a server successfully', async () => {
    const serverName = uniqueServerName('Delete');
    const server = await createMCPServerViaAPI({ name: serverName, version: '1.0.0' });

    const deleteRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}`, {
      method: 'DELETE',
    });

    expect(deleteRes.ok).toBe(true);
    const body = await deleteRes.json();
    expect(body.success).toBe(true);

    // Verify it's gone
    const getRes = await fetch(`${BASE_URL}/api/stored/mcp-servers/${server.id}?status=draft`);
    expect(getRes.status).toBe(404);
  });
});

/**
 * FEATURE: Edit UI Flow
 * USER STORY: As a user, I want to edit an MCP server from the detail page and see changes persist
 * BEHAVIOR UNDER TEST: Edit dialog pre-populates with existing values and changes persist
 */
test.describe('Edit UI Flow', () => {
  test('edit button opens dialog with pre-populated form', async ({ page }) => {
    // ARRANGE: Create server via API
    const serverName = uniqueServerName('EditPrepop');
    await createMCPServerViaAPI({
      name: serverName,
      version: '3.0.0',
    });

    // ACT: Navigate to detail page and click edit
    await navigateToServerDetail(page, serverName);
    await openEditDialog(page);

    // ASSERT: Form is pre-populated with correct values
    await expect(page.locator('#mcp-server-name')).toHaveValue(serverName, { timeout: 5000 });
    await expect(page.locator('#mcp-server-version')).toHaveValue('3.0.0', { timeout: 5000 });
  });

  test('edit dialog shows previously selected tools as enabled', async ({ page }) => {
    // ARRANGE: Create server via API with weatherInfo tool
    const serverName = uniqueServerName('EditTools');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: { weatherInfo: { description: 'Get weather info' } },
    });

    // ACT: Navigate to detail page and click edit
    await navigateToServerDetail(page, serverName);
    await openEditDialog(page);

    // ASSERT: Wait for tools to load in the dialog and verify weatherInfo switch is checked
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });
    await expect(getToolSwitch(dialog, 'weatherInfo')).toHaveAttribute('data-state', 'checked', { timeout: 5000 });
  });

  test('adding a tool via edit persists in draft', async ({ page }) => {
    // ARRANGE: Create server via API with weatherInfo tool
    const serverName = uniqueServerName('EditAdd');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: { weatherInfo: { description: 'Get weather info' } },
    });

    // ACT: Navigate to detail page, click edit, toggle simpleMcpTool ON
    await navigateToServerDetail(page, serverName);
    await openEditDialog(page);

    let dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });
    await getToolSwitch(dialog, 'simpleMcpTool').click();

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Reopen edit dialog and verify both tools are selected (draft shows edits)
    await openEditDialog(page);
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });

    await expect(getToolSwitch(dialog, 'weatherInfo')).toHaveAttribute('data-state', 'checked', { timeout: 5000 });
    await expect(getToolSwitch(dialog, 'simpleMcpTool')).toHaveAttribute('data-state', 'checked', { timeout: 5000 });
  });

  test('removing a tool via edit persists in draft', async ({ page }) => {
    // ARRANGE: Create server via API with two tools
    const serverName = uniqueServerName('EditRemove');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: {
        weatherInfo: { description: 'Get weather info' },
        simpleMcpTool: { description: 'Simple tool' },
      },
    });

    // ACT: Navigate to detail page, click edit, toggle weatherInfo OFF
    await navigateToServerDetail(page, serverName);
    await openEditDialog(page);

    let dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });
    await getToolSwitch(dialog, 'weatherInfo').click();

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Reopen edit dialog and verify only simpleMcpTool is selected
    await openEditDialog(page);
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });

    await expect(getToolSwitch(dialog, 'weatherInfo')).toHaveAttribute('data-state', 'unchecked', { timeout: 5000 });
    await expect(getToolSwitch(dialog, 'simpleMcpTool')).toHaveAttribute('data-state', 'checked', { timeout: 5000 });
  });

  test('adding a tool via edit updates the sidebar', async ({ page }) => {
    // ARRANGE: Create server via API with one tool
    const serverName = uniqueServerName('SidebarAdd');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: { weatherInfo: { description: 'Get weather info' } },
    });

    // Navigate to detail page and verify sidebar shows only weatherInfo
    await navigateToServerDetail(page, serverName);
    const sidebar = page.locator('.border-l').filter({ hasText: 'Available Tools' });
    await expect(sidebar.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('simpleMcpTool')).not.toBeVisible();

    // ACT: Open edit dialog, toggle simpleMcpTool ON, save
    await openEditDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });
    await getToolSwitch(dialog, 'simpleMcpTool').click();
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Sidebar now shows both tools
    await expect(sidebar.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });
  });

  test('removing a tool via edit updates the sidebar', async ({ page }) => {
    // ARRANGE: Create server via API with two tools
    const serverName = uniqueServerName('SidebarRemove');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: {
        weatherInfo: { description: 'Get weather info' },
        simpleMcpTool: { description: 'Simple tool' },
      },
    });

    // Navigate to detail page and verify sidebar shows both tools
    await navigateToServerDetail(page, serverName);
    const sidebar = page.locator('.border-l').filter({ hasText: 'Available Tools' });
    await expect(sidebar.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });

    // ACT: Open edit dialog, toggle weatherInfo OFF, save
    await openEditDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });
    await getToolSwitch(dialog, 'weatherInfo').click();
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Sidebar now shows only simpleMcpTool
    await expect(sidebar.getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('weatherInfo')).not.toBeVisible();
  });

  test('sidebar tools persist after page reload', async ({ page }) => {
    // ARRANGE: Create server with one tool, then add another via edit
    const serverName = uniqueServerName('SidebarPersist');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: { weatherInfo: { description: 'Get weather info' } },
    });

    await navigateToServerDetail(page, serverName);

    // Add simpleMcpTool via edit
    await openEditDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });
    await getToolSwitch(dialog, 'simpleMcpTool').click();
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ACT: Reload the page
    await page.reload();

    // ASSERT: Sidebar still shows both tools after reload
    const sidebar = page.locator('.border-l').filter({ hasText: 'Available Tools' });
    await expect(sidebar.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });
  });

  test('adding one tool and removing another in a single edit updates the sidebar', async ({ page }) => {
    // ARRANGE: Create server with weatherInfo tool
    const serverName = uniqueServerName('SwapTools');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
      tools: { weatherInfo: { description: 'Get weather info' } },
    });

    // Navigate to detail page and verify sidebar shows only weatherInfo
    await navigateToServerDetail(page, serverName);
    const sidebar = page.locator('.border-l').filter({ hasText: 'Available Tools' });
    await expect(sidebar.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('simpleMcpTool')).not.toBeVisible();

    // ACT: Open edit dialog, toggle weatherInfo OFF + toggle simpleMcpTool ON, save
    await openEditDialog(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Available Tools/ })).toBeVisible({ timeout: 10000 });

    await getToolSwitch(dialog, 'weatherInfo').click(); // remove weatherInfo
    await getToolSwitch(dialog, 'simpleMcpTool').click(); // add simpleMcpTool

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Sidebar shows only simpleMcpTool, weatherInfo is gone
    await expect(sidebar.getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });
    await expect(sidebar.getByText('weatherInfo')).not.toBeVisible();
  });

  test('editing version persists in draft', async ({ page }) => {
    // ARRANGE: Create server via API
    const serverName = uniqueServerName('EditVer');
    await createMCPServerViaAPI({
      name: serverName,
      version: '1.0.0',
    });

    // ACT: Navigate to detail page, click edit, change version
    await navigateToServerDetail(page, serverName);
    await openEditDialog(page);

    const versionInput = page.locator('#mcp-server-version');
    await versionInput.clear();
    await versionInput.fill('2.0.0');

    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('MCP server updated successfully')).toBeVisible({ timeout: 10000 });

    // ASSERT: Reopen edit dialog and verify version is updated in draft
    await openEditDialog(page);
    await expect(page.locator('#mcp-server-version')).toHaveValue('2.0.0', { timeout: 5000 });
  });
});
