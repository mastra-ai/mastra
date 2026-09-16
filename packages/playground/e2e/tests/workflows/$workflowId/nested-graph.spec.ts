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
    test.beforeEach(async ({ page }) => {
      const nestedNode = page.locator('[data-workflow-node]').filter({ hasText: 'nested-text-processor' });
      await expect(nestedNode).toBeVisible();

      await nestedNode.getByRole('button', { name: 'Step actions' }).click();
      await page.getByRole('menuitem', { name: 'View nested graph' }).click();
    });

    test('opens the nested graph view in the step detail panel', async ({ page }) => {
      const panel = page.getByTestId('workflow-step-detail-panel');
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(panel).toContainText('Workflow');
    });

    test('gives the nested graph more room when the panel is resized', async ({ page }) => {
      const panel = page.getByTestId('workflow-step-detail-panel');
      await expect(panel).toBeVisible({ timeout: 15000 });

      const initialWidth = await panel.evaluate(element => element.getBoundingClientRect().width);
      const separator = page.locator('[role="separator"][aria-controls="workflow-graph"]');
      const separatorBox = await separator.boundingBox();
      if (!separatorBox) throw new Error('Nested graph resize handle is not visible');

      await page.mouse.move(separatorBox.x, separatorBox.y + separatorBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(separatorBox.x - 180, separatorBox.y + separatorBox.height / 2, { steps: 5 });
      await page.mouse.up();

      await expect
        .poll(() => panel.evaluate(element => element.getBoundingClientRect().width))
        .toBeGreaterThan(initialWidth + 100);
    });

    test('uses the available width on smaller screens', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 });

      const panel = page.getByTestId('workflow-step-detail-panel');
      await expect.poll(() => panel.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(700);
    });
  });
});
