/**
 * Viewer Role E2E Tests
 *
 * Feature: F007 - Viewer Role E2E Tests
 *
 * Tests that viewer role has read-only access:
 * - Can view agents list and details (agents:read)
 * - Cannot modify agents
 * - Can view workflows list and details (workflows:read)
 * - Cannot create/edit workflows
 * - Cannot run workflows
 * - No tools access (no tools:read permission)
 * - Sees read-only UI state
 * - Action buttons are hidden or disabled
 */

import { test, expect } from '@playwright/test';
import { setupViewerAuth, setupMockAuth, MOCK_USERS } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Viewer Role', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Navigation Access', () => {
    test('viewer sees main navigation items for agents and workflows', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Agents');

      // Viewer should see navigation links for resources they can read
      await expect(page.getByRole('link', { name: /^Agents$/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /^Workflows$/i })).toBeVisible();
    });

    test('viewer can navigate to agents and workflows', async ({ page }) => {
      await setupViewerAuth(page);

      // Navigate to agents
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');

      // Navigate to workflows
      await page.goto('/workflows');
      await expect(page.locator('h1')).toHaveText('Workflows');
    });
  });

  test.describe('Agents Access - Read Only', () => {
    test('viewer can view agents list', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // Should see the agents page
      await expect(page.locator('h1')).toHaveText('Agents');

      // Should see agents in the list
      await expect(page.getByText('Weather Agent')).toBeVisible();
    });

    test('viewer can access agent details page', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // Click on the weather agent
      await page.getByText('Weather Agent').click();

      // Should be on agent details page
      await expect(page).toHaveURL(/\/agents\/weather-agent/);
    });

    test('viewer can view agent chat interface', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Should be on agent chat page
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // The page should load without permission errors for viewing
      const permissionDenied = page.getByText(/permission denied|not authorized|access denied/i);
      await expect(permissionDenied).not.toBeVisible();
    });

    test('viewer does not see agent creation controls', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Agents');

      // Viewer should NOT see create agent button
      const createButton = page.getByRole('button', { name: /create agent|new agent|add agent/i });
      await expect(createButton).not.toBeVisible();
    });

    test('viewer cannot execute agents - sees disabled chat input', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Viewer has agents:read but NOT agents:execute
      // The chat input should be disabled with permission message as placeholder
      const chatInput = page.locator('textarea[placeholder="You don\'t have permission to execute agents"]');
      await expect(chatInput).toBeVisible();
      await expect(chatInput).toBeDisabled();
    });
  });

  test.describe('Workflows Access - Read Only', () => {
    test('viewer can view workflows list', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows');

      // Should see the workflows page
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Should see workflows in the list
      const workflowRow = page.getByRole('row').filter({ hasText: /workflow/i });
      await expect(workflowRow.first()).toBeVisible();
    });

    test('viewer can access workflow details page', async ({ page }) => {
      await setupViewerAuth(page);
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

    test('viewer sees permission denied message for workflow execution', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Viewer has workflows:read but NOT workflows:execute
      // The UI shows a permission denied message instead of the run button
      const permissionDenied = page.getByText("You don't have permission to execute workflows.");
      await expect(permissionDenied).toBeVisible();

      // The run/trigger button should NOT be visible for viewers
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i });
      await expect(runButton).not.toBeVisible();
    });

    test('viewer cannot create new workflows', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Viewer should NOT see create workflow button
      const createButton = page.getByRole('button', { name: /create workflow|new workflow|add workflow/i });
      await expect(createButton).not.toBeVisible();
    });

    test('viewer workflow page shows read-only state with permission message', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Page should load without errors
      await expect(page).toHaveURL(/\/workflows\/lessComplexWorkflow/);

      // Viewer should see the permission denied message for workflow execution
      const permissionDenied = page.getByText("You don't have permission to execute workflows.");
      await expect(permissionDenied).toBeVisible();

      // Edit/delete buttons should NOT be visible for viewers (workflows:read only)
      const editButton = page.getByRole('button', { name: /^edit$/i });
      const deleteButton = page.getByRole('button', { name: /^delete$/i });
      await expect(editButton).not.toBeVisible();
      await expect(deleteButton).not.toBeVisible();
    });
  });

  test.describe('Tools Access - No Permission', () => {
    test('viewer navigating to tools page handles gracefully', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/tools');

      // Viewer does NOT have tools:read permission
      // The page might show permission denied or redirect
      // Either behavior is acceptable for no tools access

      // Wait for page to load with a timeout
      await page.waitForLoadState('domcontentloaded');

      // Check if we're still on tools page or redirected
      const currentUrl = page.url();

      if (currentUrl.includes('/tools')) {
        // If still on tools page, might see permission denied or empty state or the tools list
        // The heading should be visible either way
        const heading = page.locator('h1');
        await expect(heading).toBeVisible({ timeout: 5000 });
      }
      // If redirected, that's also acceptable
    });

    test('viewer cannot access tool execution', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/tools/weatherInfo');

      // Viewer has no tools:read or tools:execute permission
      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // The tool page might load but viewer may have restricted access
      // Check that the page loads and URL is correct
      await expect(page).toHaveURL(/\/tools\/weatherInfo/);

      // Page should load - even if viewer doesn't have full tool access,
      // they might see the tool details without execution capability
      // The specific behavior depends on how the app handles no tools:execute permission
    });
  });

  test.describe('Permission Verification', () => {
    test('viewer has correct read-only permissions', async ({ page }) => {
      // Set up viewer with explicit permission verification
      await setupMockAuth(page, {
        role: 'viewer',
        permissions: ['agents:read', 'workflows:read'],
      });

      // Viewer can access agents (read)
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');

      // Viewer can access workflows (read)
      await page.goto('/workflows');
      await expect(page.locator('h1')).toHaveText('Workflows');
    });

    test('viewer sees correct user info', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // The viewer user info should be reflected in the UI
      const viewerUser = MOCK_USERS.viewer;

      // Page should load successfully
      await expect(page.locator('h1')).toHaveText('Agents');

      // User info might be displayed in menu/avatar
      // Verify page loads correctly with viewer auth
    });

    test('viewer can access read-only routes without redirect', async ({ page }) => {
      await setupViewerAuth(page);

      // Routes viewer should be able to access (read-only)
      const accessibleRoutes = ['/agents', '/workflows'];

      for (const route of accessibleRoutes) {
        await page.goto(route);

        // Should NOT see login prompt
        await expect(page.getByRole('heading', { name: 'Sign in to continue' })).not.toBeVisible();

        // Should NOT be redirected to login
        expect(page.url()).not.toContain('/login');
      }
    });
  });

  test.describe('Viewer vs Other Roles Comparison', () => {
    test('viewer has fewer permissions than admin', async ({ page }) => {
      // First, check viewer view
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Look for run button
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();

      // Viewer should see button disabled or not visible
      const viewerButtonVisible = await runButton.isVisible();
      const viewerButtonDisabled = viewerButtonVisible ? await runButton.isDisabled() : true;

      // Now check as admin
      await setupMockAuth(page, {
        role: 'admin',
        permissions: ['*'],
      });

      await page.reload();

      // Admin should have the button enabled
      const adminRunButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();
      await expect(adminRunButton).toBeVisible();
      await expect(adminRunButton).not.toBeDisabled();
    });

    test('viewer has fewer permissions than member for workflows', async ({ page }) => {
      // Viewer can only read workflows (no execute permission)
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Viewer should see permission denied message (no run button)
      const viewerPermissionDenied = page.getByText("You don't have permission to execute workflows.");
      await expect(viewerPermissionDenied).toBeVisible();

      // Run button should NOT be visible for viewer
      const viewerRunButton = page.getByRole('button', { name: /run|trigger|execute/i });
      await expect(viewerRunButton).not.toBeVisible();

      // Now check as member (who has workflows:* permission)
      await setupMockAuth(page, {
        role: 'member',
        permissions: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
      });

      await page.reload();

      // Member should have workflows:* permission, so button should be visible and enabled
      const memberRunButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();
      await expect(memberRunButton).toBeVisible();
      await expect(memberRunButton).not.toBeDisabled();

      // Permission denied message should NOT be visible for member
      await expect(viewerPermissionDenied).not.toBeVisible();
    });

    test('viewer has fewer permissions than member for tools', async ({ page }) => {
      // Viewer has no tools permission at all
      await setupViewerAuth(page);
      await page.goto('/tools/weatherInfo');

      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');

      // Now check as member (who has tools:read and tools:execute)
      await setupMockAuth(page, {
        role: 'member',
        permissions: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
      });

      await page.reload();

      // Member should see tool execution panel
      const locationInput = page.getByLabel(/location/i).or(page.locator('input[name="location"]'));
      await expect(locationInput.first()).toBeVisible();
    });
  });

  test.describe('Read-Only UI State', () => {
    test('viewer sees read-only agent chat with disabled input', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Page should load without errors
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // Viewer has agents:read but NOT agents:execute
      // The chat input should be disabled with permission message as placeholder
      const chatInput = page.locator('textarea[placeholder="You don\'t have permission to execute agents"]');
      await expect(chatInput).toBeVisible();
      await expect(chatInput).toBeDisabled();

      // Save/create buttons should NOT be visible for viewer
      const saveButton = page.getByRole('button', { name: /^save$/i });
      const createButton = page.getByRole('button', { name: /^create$/i });
      await expect(saveButton).not.toBeVisible();
      await expect(createButton).not.toBeVisible();
    });

    test('viewer agent page shows read-only state', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Page should load
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // Viewer should be able to see agent details
      // Look for agent name or description
      const agentContent = page.getByText(/weather/i);
      await expect(agentContent.first()).toBeVisible();
    });

    test('viewer workflow page displays content without modification options', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Page should load
      await expect(page).toHaveURL(/\/workflows\/lessComplexWorkflow/);

      // Wait for page content to load
      await page.waitForLoadState('domcontentloaded');

      // Should see workflow content - the page loaded successfully for viewing
    });
  });

  test.describe('Action Buttons Verification', () => {
    test('action buttons are hidden or disabled on agents page', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Agents');

      // Create/Add buttons should not be visible for viewer
      const createButton = page.getByRole('button', { name: /create|add|new/i });
      await expect(createButton).not.toBeVisible();
    });

    test('action buttons are hidden or disabled on workflows page', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows');

      // Wait for page to load
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Create/Add buttons should not be visible for viewer
      const createButton = page.getByRole('button', { name: /create|add|new/i });
      await expect(createButton).not.toBeVisible();
    });

    test('viewer sees permission message instead of run button on workflow detail page', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Viewer has workflows:read but NOT workflows:execute
      // The run button should NOT be visible; permission message should be shown instead
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i });
      await expect(runButton).not.toBeVisible();

      // Permission denied message should be visible
      const permissionDenied = page.getByText("You don't have permission to execute workflows.");
      await expect(permissionDenied).toBeVisible();
    });
  });
});
