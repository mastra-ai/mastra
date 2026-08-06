import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

// FEATURE: View nested graph from a workflow step
// USER STORY: As a Studio user, I want to click "View nested graph" on a nested
// workflow step so I can inspect the nested workflow's graph without leaving the page.
// BEHAVIOR UNDER TEST: Triggering "View nested graph" mounts the step detail panel
// showing the nested workflow.

test.describe('Workflow nested graph', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows/complexWorkflow/graph');
  });

  test.describe('when "View nested graph" is selected on a nested step', () => {
    test('opens the nested graph view in the step detail panel', async ({ page }) => {
      const nestedNode = page.locator('[data-workflow-node]').filter({ hasText: 'nested-text-processor' });
      await expect(nestedNode).toBeVisible();

      await nestedNode.getByRole('button', { name: 'Step actions' }).click();
      await page.getByRole('menuitem', { name: 'View nested graph' }).click();

      const panel = page.getByTestId('workflow-step-detail-panel');
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(panel).toContainText('Workflow');
    });
  });
});
