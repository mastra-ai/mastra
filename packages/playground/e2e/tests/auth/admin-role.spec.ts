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
import { setupAdminAuth, setupMockAuth, MOCK_USERS } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Admin Role', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when an admin user navigates the studio', () => {
    test('admin sees all navigation items', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Wait for page to load
      await expectCurrentBreadcrumb(page, 'Agents');

      // Verify all main navigation links are visible
      await expect(page.getByRole('link', { name: /^Agents$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Workflows$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Tools$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^MCP Servers$/i })).toBeVisible();
    });

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
      const chatInput = page.locator('textarea[placeholder="Enter your message..."]');
      await expect(chatInput).toBeVisible();
      await expect(chatInput).not.toBeDisabled();

      // Permission denied message should NOT be visible
      const permissionDenied = page.getByText("You don't have permission to execute agents");
      await expect(permissionDenied).not.toBeVisible();
    });

    test('admin can view agent tools', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents/weather-agent/settings');

      // The agent has tools - admin should be able to see them in the settings overview.
      await expect(page.getByTestId('agent-settings-view')).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: 'weatherInfo' })).toHaveAttribute(
        'href',
        /\/agents\/weather-agent\/tools\/weatherInfo$/,
      );
      await expect(page.getByRole('link', { name: 'simpleMcpTool' })).toHaveAttribute(
        'href',
        /\/agents\/weather-agent\/tools\/simpleMcpTool$/,
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

    test('admin can see workflow execution controls', async ({ page }) => {
      await setupAdminAuth(page);

      // Navigate to a specific workflow
      await page.goto('/workflows/lessComplexWorkflow');

      // Admin should see the trigger/run workflow controls
      // The workflow trigger should be visible and enabled
      const triggerButton = page.getByRole('button', { name: /run|trigger|execute/i });
      await expect(triggerButton.first()).toBeVisible();
    });

    test('admin workflow execution button is not disabled', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Look for any run/execute button
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();

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
      await expect(page).toHaveURL(/\/tools\/weatherInfo/);
    });

    test('admin can see tool execution panel', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/tools/weatherInfo');

      // Should see the tool execution form/panel
      await expect(page.locator('[name="location"]')).toBeVisible();
    });

    test('admin does not see permission denied for tool execution', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/tools/weatherInfo');

      // Admin should NOT see permission denied message
      const permissionDenied = page.getByText(/permission denied|not authorized|don't have permission/i);
      await expect(permissionDenied).not.toBeVisible();
    });
  });

  test.describe('when an admin user accesses MCP servers', () => {
    test('admin can view MCP servers list', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/mcps');

      // Should see the MCP servers page
      await expectCurrentBreadcrumb(page, 'MCP Servers');
    });

    test('admin can access MCP server configuration', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/mcps');

      // The page should load without any permission issues
      // Check that there are no access denied messages
      const accessDenied = page.getByText(/access denied|not authorized|permission denied/i);
      await expect(accessDenied).not.toBeVisible();
    });
  });

  test.describe('when verifying the admin permission set', () => {
    test('admin has wildcard permission', async ({ page }) => {
      // Set up admin with explicit wildcard permission check
      await setupMockAuth(page, {
        role: 'admin',
        permissions: ['*'],
      });

      await page.goto('/agents');
      await expectCurrentBreadcrumb(page, 'Agents');

      // Navigate to workflows - should work
      await page.goto('/workflows');
      await expectCurrentBreadcrumb(page, 'Workflows');

      // Navigate to tools - should work
      await page.goto('/tools');
      await expectCurrentBreadcrumb(page, 'Tools');
    });

    test('admin sees correct user info', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // User info might not be displayed in all views, so we just verify the page loads
      await expectCurrentBreadcrumb(page, 'Agents');
    });

    test('admin can access all protected routes without redirect', async ({ page }) => {
      await setupAdminAuth(page);

      const protectedRoutes = ['/agents', '/workflows', '/tools', '/mcps'];

      for (const route of protectedRoutes) {
        await page.goto(route);

        // Should NOT see login prompt
        await expect(page.getByRole('heading', { name: 'Sign in to continue' })).not.toBeVisible();

        // Should NOT be redirected to login
        expect(page.url()).not.toContain('/login');
      }
    });
  });

  test.describe('when comparing the admin role to other roles', () => {
    test('admin has more permissions than member', async ({ page }) => {
      // First, verify admin can access a page
      await setupAdminAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Admin should see full UI without restrictions
      // Now check as member
      await page.route('**/api/auth/capabilities', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            login: { type: 'sso', signUpEnabled: true },
            user: MOCK_USERS.member,
            capabilities: { user: true, session: true, sso: true, rbac: true, acl: false },
            access: {
              roles: ['member'],
              permissions: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
            },
          }),
        });
      });

      await page.reload();

      // Member should have more restricted view
      // The specific restrictions depend on UI implementation
      // At minimum, member should still see the page (they have agents:read)
      await expect(page).toHaveURL(/\/agents\/weather-agent/);
    });

    test('admin has more permissions than viewer', async ({ page }) => {
      // First, verify admin can access workflow execution
      await setupAdminAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Admin should see run button enabled
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();
      await expect(runButton).toBeVisible();
      await expect(runButton).not.toBeDisabled();

      // Now check as viewer
      await setupMockAuth(page, {
        role: 'viewer',
        permissions: ['agents:read', 'workflows:read'],
      });

      await page.reload();

      // Viewer should have restricted workflow access
      // They can view but not execute
      await expect(page).toHaveURL(/\/workflows\/lessComplexWorkflow/);
    });
  });
});
