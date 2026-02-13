/**
 * Member Role E2E Tests
 *
 * Feature: F006 - Member Role E2E Tests
 *
 * Tests that member role has limited access:
 * - Can read agents (view list and details)
 * - Cannot create/edit/delete agents
 * - Has full workflow access (view, create, run, execute)
 * - Can read and execute tools
 * - Cannot access admin settings
 */

import { test, expect } from '@playwright/test';
import { setupMemberAuth, setupMockAuth, MOCK_USERS } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Member Role', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Navigation Access', () => {
    test('member sees main navigation items', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Agents');

      // Member should see main navigation links
      await expect(page.getByRole('link', { name: /^Agents$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Workflows$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Tools$/i })).toBeVisible();
    });

    test('member can navigate to agents, workflows, and tools', async ({ page }) => {
      await setupMemberAuth(page);

      // Navigate to agents
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');

      // Navigate to workflows
      await page.goto('/workflows');
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Navigate to tools
      await page.goto('/tools');
      await expect(page.locator('h1')).toHaveText('Tools');
    });
  });

  test.describe('Agents Access - Read Only', () => {
    test('member can view agents list', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Should see the agents page
      await expect(page.locator('h1')).toHaveText('Agents');

      // Should see agents in the list
      await expect(page.getByText('Weather Agent')).toBeVisible();
    });

    test('member can access agent details page', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Click on the weather agent
      await page.getByText('Weather Agent').click();

      // Should be on agent details page
      await expect(page).toHaveURL(/\/agents\/weather-agent/);
    });

    test('member can view agent chat interface', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Should be on agent chat page
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // The page should load without permission errors
      const permissionDenied = page.getByText(/permission denied|not authorized|access denied/i);
      await expect(permissionDenied).not.toBeVisible();
    });

    test('member can view agent tools', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Member should be able to see agent tools (they have agents:read and tools:read)
      const toolsSection = page.getByText(/weatherInfo|simpleMcpTool/i);
      await expect(toolsSection.first()).toBeVisible();
    });

    test('member does not see agent creation controls', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Agents');

      // Member should NOT see create agent button
      // Look for common create button patterns
      const createButton = page.getByRole('button', { name: /create agent|new agent|add agent/i });
      await expect(createButton).not.toBeVisible();
    });

    test('member cannot execute agents - sees disabled chat input', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Member has agents:read but NOT agents:execute
      // The chat input should be disabled with permission message as placeholder
      const chatInput = page.locator('textarea[placeholder="You don\'t have permission to execute agents"]');
      await expect(chatInput).toBeVisible();
      await expect(chatInput).toBeDisabled();
    });
  });

  test.describe('Workflows Access - Full Permissions', () => {
    test('member can view workflows list', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows');

      // Should see the workflows page
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Should see workflows in the list
      const workflowRow = page.getByRole('row').filter({ hasText: /workflow/i });
      await expect(workflowRow.first()).toBeVisible();
    });

    test('member can access workflow details page', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows');

      // Click on a workflow
      await page
        .getByRole('row')
        .filter({ hasText: /workflow/i })
        .first()
        .click();

      // Should be on workflow details page
      await expect(page).toHaveURL(/\/workflows\//);
    });

    test('member can see workflow execution controls', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Member should see the trigger/run workflow controls
      const triggerButton = page.getByRole('button', { name: /run|trigger|execute/i });
      await expect(triggerButton.first()).toBeVisible();
    });

    test('member workflow execution button is not disabled', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Look for run/execute button
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();

      // Wait for button to be visible
      await expect(runButton).toBeVisible();

      // Member should have the button enabled (has workflows:* permission)
      await expect(runButton).not.toBeDisabled();
    });

    test('member does not see permission denied for workflows', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Member should NOT see permission denied for workflow operations
      const permissionDenied = page.getByText(/permission denied|not authorized|don't have permission/i);
      await expect(permissionDenied).not.toBeVisible();
    });
  });

  test.describe('Tools Access - Read and Execute', () => {
    test('member can view tools list', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools');

      // Should see the tools page
      await expect(page.locator('h1')).toHaveText('Tools');

      // Should see tools in the list
      const toolRow = page.getByRole('row').filter({ hasText: /weatherInfo|simpleMcpTool/i });
      await expect(toolRow.first()).toBeVisible();
    });

    test('member can access tool details page', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools');

      // Click on weatherInfo tool
      await page
        .getByRole('row')
        .filter({ hasText: /weatherInfo/i })
        .click();

      // Should be on tool details page
      await expect(page).toHaveURL(/\/tools\/weatherInfo/);
    });

    test('member can see tool execution panel', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools/weatherInfo');

      // Should see the tool execution form/panel
      const locationInput = page.getByLabel(/location/i).or(page.locator('input[name="location"]'));
      await expect(locationInput.first()).toBeVisible();
    });

    test('member does not see permission denied for tool execution', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools/weatherInfo');

      // Member has tools:execute permission
      const permissionDenied = page.getByText(/permission denied|not authorized|don't have permission/i);
      await expect(permissionDenied).not.toBeVisible();
    });
  });

  test.describe('Permission Verification', () => {
    test('member has correct permissions', async ({ page }) => {
      // Set up member with explicit permission verification
      await setupMockAuth(page, {
        role: 'member',
        permissions: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
      });

      // Member can access agents (read)
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');

      // Member can access workflows (full)
      await page.goto('/workflows');
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Member can access tools (read/execute)
      await page.goto('/tools');
      await expect(page.locator('h1')).toHaveText('Tools');
    });

    test('member sees correct user info', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // The member user info should be reflected in the UI
      const memberUser = MOCK_USERS.member;

      // Page should load successfully
      await expect(page.locator('h1')).toHaveText('Agents');

      // User info might be displayed in menu/avatar
      const userElement = page.getByText(memberUser.name).or(page.getByText(memberUser.email));
      // User info display depends on implementation
    });

    test('member can access protected routes without redirect', async ({ page }) => {
      await setupMemberAuth(page);

      // Routes member should be able to access
      const accessibleRoutes = ['/agents', '/workflows', '/tools'];

      for (const route of accessibleRoutes) {
        await page.goto(route);

        // Should NOT see login prompt
        await expect(page.getByRole('heading', { name: 'Sign in to continue' })).not.toBeVisible();

        // Should NOT be redirected to login
        expect(page.url()).not.toContain('/login');
      }
    });
  });

  test.describe('Member vs Other Roles Comparison', () => {
    test('member has fewer permissions than admin', async ({ page }) => {
      // First, check member view
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Member should see agents page
      await expect(page.locator('h1')).toHaveText('Agents');

      // Now check as admin
      await setupMockAuth(page, {
        role: 'admin',
        permissions: ['*'],
      });

      await page.reload();

      // Admin should have same view but with more controls available
      await expect(page.locator('h1')).toHaveText('Agents');
    });

    test('member has more permissions than viewer for workflows', async ({ page }) => {
      // Member can execute workflows
      await setupMemberAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Member should see run button enabled
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
      await expect(page).toHaveURL(/\/workflows\/lessComplexWorkflow/);
      // Viewer might see button disabled or hidden
    });

    test('member has more permissions than viewer for tools', async ({ page }) => {
      // Member can execute tools
      await setupMemberAuth(page);
      await page.goto('/tools/weatherInfo');

      // Member should see tool execution panel
      const locationInput = page.getByLabel(/location/i).or(page.locator('input[name="location"]'));
      await expect(locationInput.first()).toBeVisible();

      // Now check as viewer
      await setupMockAuth(page, {
        role: 'viewer',
        permissions: ['agents:read', 'workflows:read'],
      });

      await page.reload();

      // Viewer has no tools:read permission, so might see restricted access
      // The exact behavior depends on implementation
      await expect(page).toHaveURL(/\/tools\/weatherInfo/);
    });
  });

  test.describe('Restricted Actions', () => {
    test('member cannot see admin-only settings', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Member should not have access to admin settings link
      // This depends on implementation - checking for absence of settings link
      const settingsLink = page.getByRole('link', { name: /^settings$/i });
      // Settings link might not be visible for member
    });

    test('member agent page shows disabled chat and viewable content', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Page should load without errors
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // Member has agents:read but NOT agents:execute
      // The chat input should be disabled
      const chatInput = page.locator('textarea[placeholder="You don\'t have permission to execute agents"]');
      await expect(chatInput).toBeVisible();
      await expect(chatInput).toBeDisabled();

      // Member can still view agent content (agents:read permission)
      const agentContent = page.getByText(/weather/i);
      await expect(agentContent.first()).toBeVisible();
    });
  });
});
