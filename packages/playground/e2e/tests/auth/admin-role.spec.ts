/**
 * Admin Role E2E Tests
 *
 * Feature: F005 - Admin Role E2E Tests
 *
 * Tests that admin role has full access to all Mastra resources:
 * - Agents (view, settings)
 * - Workflows (view, execute, delete runs)
 * - Tools (view, execute)
 * - MCP Servers (view, configure)
 * - Settings and configuration
 */

import { test, expect } from '@playwright/test';
import { setupAdminAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Admin Role', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an admin user navigates the studio', () => {
    test('admin can navigate to all main sections', async ({ page }) => {
      await setupAdminAuth(page);

      // Navigate through all main sections
      await page.goto('/agents');
      await expectCurrentBreadcrumb(page, 'Agents');

      await page.goto('/workflows');
      await expectCurrentBreadcrumb(page, 'Workflows');

      await page.goto('/tools');
      await expectCurrentBreadcrumb(page, 'Tools');

      await page.goto('/mcps');
      await expectCurrentBreadcrumb(page, 'MCP Servers');
    });
  });

  test.describe('when an admin user accesses agents', () => {
    test('admin can view agents list', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Should see the agents page
      await expectCurrentBreadcrumb(page, 'Agents');

      // Should see at least the weather-agent in the list
      await expect(page.getByText('Weather Agent')).toBeVisible();
    });

    test('admin can access agent details page', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Click on the weather agent
      await page.getByText('Weather Agent').click();

      // Should be on agent chat page
      await expect(page).toHaveURL(/\/agents\/weather-agent/);
    });

    test('admin can execute agents - chat input is enabled', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Admin has wildcard permissions, so agents:execute is granted
      // The chat input should be enabled with normal placeholder
      const chatInput = page.locator('textarea[placeholder="Enter your message"]');
      await expect(chatInput).toBeVisible();
      await expect(chatInput).not.toBeDisabled();

      // Permission denied message should NOT be visible
      const permissionDenied = page.getByText("You don't have permission to execute agents");
      await expect(permissionDenied).not.toBeVisible();
    });

    test('admin can view agent tools', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents/weather-agent/chat/new');

      // The overview side panel starts collapsed; the admin can open it and see the agent tools.
      await page.getByTestId('agent-overview-panel-toggle').click();
      await expect(page.getByTestId('agent-overview-panel')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('heading', { name: /^Tools/ })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: 'weatherInfo' })).toHaveAttribute(
        'href',
        // The chip opens the tool drawer over the agent page you're on.
        /\/agents\/weather-agent\/threads\/[^/?]+\?tool=weatherInfo$/,
      );
      await expect(page.getByRole('link', { name: 'simpleMcpTool' })).toHaveAttribute(
        'href',
        /\/agents\/weather-agent\/threads\/[^/?]+\?tool=simpleMcpTool$/,
      );
    });
  });

  test.describe('when an admin user accesses workflows', () => {
    test('admin can view workflows list', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/workflows');

      // Should see the workflows page
      await expectCurrentBreadcrumb(page, 'Workflows');

      // Should see workflows in the list
      const workflowRow = page.locator('.data-list-row').filter({ hasText: /workflow/i });
      await expect(workflowRow.first()).toBeVisible();
    });

    test('admin can access workflow details page', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/workflows');

      // Click on a workflow
      await page
        .locator('.data-list-row')
        .filter({ hasText: /workflow/i })
        .first()
        .click();

      // Should be on workflow details page
      await expect(page).toHaveURL(/\/workflows\//);
    });

    test('admin workflow execution button is not disabled', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Look for any run/execute button
      const runButton = page.getByRole('button', { name: 'Run', exact: true });

      // Wait for button to be visible
      await expect(runButton).toBeVisible();

      // Admin should have the button enabled
      await expect(runButton).not.toBeDisabled();
    });
  });

  test.describe('when an admin user accesses tools', () => {
    test('admin can view tools list', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/tools');

      // Should see the tools page
      await expectCurrentBreadcrumb(page, 'Tools');

      // Should see tools in the list
      const toolRow = page.locator('.data-list-row').filter({ hasText: /weatherInfo|simpleMcpTool/i });
      await expect(toolRow.first()).toBeVisible();
    });

    test('admin can access tool details page', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/tools');

      // Click on weatherInfo tool
      await page
        .locator('.data-list-row')
        .filter({ hasText: /weatherInfo/i })
        .click();

      // Should be on tool details page
      await expect(page).toHaveURL(/\/tools\?tool=weatherInfo/);
    });

    test('admin can see tool execution panel', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/tools?tool=weatherInfo');

      // The execution form lives on the Playground tab
      await page.getByRole('tab', { name: 'Playground' }).click();
      await expect(page.locator('[name="location"]')).toBeVisible();
    });
  });
});
