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
import { setupMemberAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

test.describe('Member Role', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when a member user navigates the studio', () => {
    test('member can navigate to agents, workflows, and tools', async ({ page }) => {
      await setupMemberAuth(page);

      // Navigate to agents
      await page.goto('/agents');
      await expectCurrentBreadcrumb(page, 'Agents');

      // Navigate to workflows
      await page.goto('/workflows');
      await expectCurrentBreadcrumb(page, 'Workflows');

      // Navigate to tools
      await page.goto('/tools');
      await expectCurrentBreadcrumb(page, 'Tools');
    });
  });

  test.describe('when a member user accesses agents read-only', () => {
    test('member can view agents list', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Should see the agents page
      await expectCurrentBreadcrumb(page, 'Agents');

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

    test('member can view agent tools', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents/weather-agent/chat/new');

      // The overview side panel starts collapsed; the member can open it and see the agent tools.
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

  test.describe('when a member user accesses workflows with full permissions', () => {
    test('member can view workflows list', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows');

      // Should see the workflows page
      await expectCurrentBreadcrumb(page, 'Workflows');

      // Should see workflows in the list
      const workflowRow = page.locator('.data-list-row').filter({ hasText: /workflow/i });
      await expect(workflowRow.first()).toBeVisible();
    });

    test('member can access workflow details page', async ({ page }) => {
      await setupMemberAuth(page);
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

    test('member workflow execution button is not disabled', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Look for run/execute button
      const runButton = page.getByRole('button', { name: 'Run', exact: true });

      // Wait for button to be visible
      await expect(runButton).toBeVisible();

      // Member should have the button enabled (has workflows:* permission)
      await expect(runButton).not.toBeDisabled();
    });
  });

  test.describe('when a member user accesses tools to read and execute', () => {
    test('member can view tools list', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools');

      // Should see the tools page
      await expectCurrentBreadcrumb(page, 'Tools');

      // Should see tools in the list
      const toolRow = page.locator('.data-list-row').filter({ hasText: /weatherInfo|simpleMcpTool/i });
      await expect(toolRow.first()).toBeVisible();
    });

    test('member can access tool details page', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools');

      // Click on weatherInfo tool
      await page
        .locator('.data-list-row')
        .filter({ hasText: /weatherInfo/i })
        .click();

      // Should be on tool details page
      await expect(page).toHaveURL(/\/tools\?tool=weatherInfo/);
    });

    test('member can see tool execution panel', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/tools?tool=weatherInfo');

      // The execution form lives on the Playground tab
      await page.getByRole('tab', { name: 'Playground' }).click();
      await expect(page.locator('[name="location"]')).toBeVisible();
    });
  });
});
