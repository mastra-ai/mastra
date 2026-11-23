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
import { setupViewerAuth, setupMockAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Viewer Role', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a viewer user navigates the studio', () => {
    test('viewer can navigate to agents and workflows', async ({ page }) => {
      await setupViewerAuth(page);

      // Navigate to agents
      await page.goto('/agents');
      await expectCurrentBreadcrumb(page, 'Agents');

      // Navigate to workflows
      await page.goto('/workflows');
      await expectCurrentBreadcrumb(page, 'Workflows');
    });
  });

  test.describe('when a viewer user accesses agents read-only', () => {
    test('viewer can view agents list', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/agents');

      // Should see the agents page
      await expectCurrentBreadcrumb(page, 'Agents');

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

  test.describe('when a viewer user accesses workflows read-only', () => {
    test('viewer can view workflows list', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows');

      // Should see the workflows page
      await expectCurrentBreadcrumb(page, 'Workflows');

      // Should see workflows in the list
      const workflowRow = page.locator('.data-list-row').filter({ hasText: /workflow/i });
      await expect(workflowRow.first()).toBeVisible();
    });

    test('viewer can access workflow details page', async ({ page }) => {
      await setupViewerAuth(page);
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

    test('viewer sees permission denied message for workflow execution', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Viewer has workflows:read but NOT workflows:execute
      // The UI shows a permission denied message instead of the run button
      const permissionDenied = page.getByText("You don't have permission to execute workflows.");
      await expect(permissionDenied).toBeVisible();

      // The run/trigger button should NOT be visible for viewers
      const runButton = page.getByRole('button', { name: 'Run', exact: true });
      await expect(runButton).not.toBeVisible();
    });
  });

  test.describe('when a viewer user accesses tools without permission', () => {
    test('viewer navigating to tools page handles gracefully', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/tools');

      // Viewer does NOT have tools:read permission.
      // RoutePermissionGuard redirects to the first accessible route (/agents).
      await page.waitForURL(/\/agents(\/|$)/);
      await expectCurrentBreadcrumb(page, 'Agents');
    });

    test('viewer cannot access tool execution', async ({ page }) => {
      await setupViewerAuth(page);
      await page.goto('/tools?tool=weatherInfo');

      // Viewer has no tools:read permission. The old tool URL now lands on the Tools page
      // (`/tools?tool=weatherInfo`), which RoutePermissionGuard sends to the first accessible route.
      await page.waitForURL(/\/agents(\/|$)/);
      await expectCurrentBreadcrumb(page, 'Agents');
    });
  });

  test.describe('when comparing the viewer role to other roles', () => {
    test('viewer has fewer permissions than member for workflows', async ({ page }) => {
      // Viewer can only read workflows (no execute permission)
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Viewer should see permission denied message (no run button)
      const viewerPermissionDenied = page.getByText("You don't have permission to execute workflows.");
      await expect(viewerPermissionDenied).toBeVisible();

      // Run button should NOT be visible for viewer
      const viewerRunButton = page.getByRole('button', { name: 'Run', exact: true });
      await expect(viewerRunButton).not.toBeVisible();

      // Now check as member (who has workflows:* permission)
      await setupMockAuth(page, {
        role: 'member',
        permissions: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
      });

      await page.reload();

      // Member should have workflows:* permission, so button should be visible and enabled
      const memberRunButton = page.getByRole('button', { name: 'Run', exact: true });
      await expect(memberRunButton).toBeVisible();
      await expect(memberRunButton).not.toBeDisabled();

      // Permission denied message should NOT be visible for member
      await expect(viewerPermissionDenied).not.toBeVisible();
    });
  });
});
