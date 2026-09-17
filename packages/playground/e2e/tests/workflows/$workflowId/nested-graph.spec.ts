import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { topLevelWorkflowNodes } from '../../__utils__/workflow-nodes';

test.describe('Workflow nested graph', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows/complexWorkflow/graph');
  });

  test.describe('when "View nested graph" is selected on a nested step', () => {
    test.beforeEach(async ({ page }) => {
      const nestedNode = topLevelWorkflowNodes(page).filter({ hasText: 'nested-text-processor' });
      await expect(nestedNode).toBeVisible();

      await nestedNode.getByRole('button', { name: 'Step actions' }).first().click();
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

      const separator = page.locator('[role="separator"][aria-controls="workflow-graph"]');
      await separator.locator('span').first().hover();
      const initialWidth = await panel.evaluate(element => element.getBoundingClientRect().width);
      const separatorBox = await separator.boundingBox();
      if (!separatorBox) throw new Error('Nested graph resize handle is not visible');

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
