import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectWorkflowDataPath } from '../../__utils__/workflow-edges';

/**
 * FEATURE: Workflow debug mode "Run next step" — edge activation.
 * USER STORY: As a Studio user advancing a workflow one step at a time, I want the
 *   graph to honestly represent the path the data took: an edge is green only when
 *   data actually flowed along that transition. Un-taken branches stay neutral.
 * BEHAVIOR UNDER TEST: After a full per-step run (input "A" -> short-text branch),
 *   every edge on the taken data path is data-edge-status="success", while the edge
 *   leaving the un-taken branch arm (long-text) stays data-edge-status="idle".
 *
 * Edge state is exposed for verification via data attributes on the edge path:
 * data-edge-from, data-edge-to, data-edge-status. (See workflow-edges util.)
 */

test.afterEach(async () => {
  await resetStorage();
});

const DEBUG_CONTROLS = '[data-testid="workflow-debug-step-controls"]';

function runButton(page: Page) {
  return page.getByRole('button', { name: 'Run', exact: true });
}

function runNextStepButton(page: Page) {
  return page.locator(DEBUG_CONTROLS).getByRole('button', { name: 'Run next step' });
}

function nodes(page: Page) {
  return page.locator('[data-workflow-node]');
}

async function expectStepSuccess(page: Page, index: number) {
  await expect(nodes(page).nth(index)).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 20000 });
}

async function runNextStep(page: Page) {
  const button = runNextStepButton(page);
  await expect(button).toBeEnabled({ timeout: 20000 });
  await button.click();
  await expect(button).toBeEnabled({ timeout: 20000 });
}

test('graph edges trace the data path after a per-step run', async ({ page }) => {
  await page.goto('/workflows/complexWorkflow/graph');

  // ARRANGE: input + debug mode on. Input "A" forces the short-text branch.
  await page.getByRole('textbox', { name: 'Text' }).fill('A');
  await page.getByRole('switch', { name: 'Debug' }).click();
  await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

  // ACT: start. With debug on, this runs per-step and pauses immediately.
  await runButton(page).click();
  await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

  // Drive the whole flow one step at a time.
  await runNextStep(page); // add-letter
  await expectStepSuccess(page, 0);

  await runNextStep(page); // parallel: add-letter-b + add-letter-c
  await expectStepSuccess(page, 1);
  await expectStepSuccess(page, 2);

  await runNextStep(page); // map (post-parallel)
  await expectStepSuccess(page, 3);

  await runNextStep(page); // short-text branch arm
  await expectStepSuccess(page, 5);

  await runNextStep(page); // map (post-branch)
  await expectStepSuccess(page, 8);

  // Nested workflow runs atomically; this advance also runs the doUntil body and
  // stops at the suspend boundary (step 12).
  const button = runNextStepButton(page);
  await expect(button).toBeEnabled({ timeout: 20000 });
  await button.click();
  await expectStepSuccess(page, 9); // nested-text-processor
  await expectStepSuccess(page, 10); // add-letter-with-count
  await expect(nodes(page).nth(12)).toHaveAttribute('data-workflow-step-status', 'suspended', { timeout: 20000 });

  // Resume the suspended step.
  const suspendedSteps = page.getByTestId('workflow-suspended-steps');
  await suspendedSteps.getByRole('textbox', { name: 'User Input' }).fill('Hello');
  await suspendedSteps.getByRole('button', { name: 'Resume' }).click();
  await expectStepSuccess(page, 12); // suspend-resume

  // Final step finishes the whole run.
  const finalButton = runNextStepButton(page);
  await expect(finalButton).toBeEnabled({ timeout: 20000 });
  await finalButton.click();
  await expectStepSuccess(page, 13); // final-step

  // ASSERT: the graph represents the data path. Every step on the taken path has
  // active outgoing edges; the un-taken branch arm (long-text) stays neutral.
  await expectWorkflowDataPath(page, {
    active: [
      'add-letter',
      'add-letter-b',
      'add-letter-c',
      'short-text',
      'nested-text-processor',
      'add-letter-with-count',
      'suspend-resume',
    ],
    idle: ['long-text'],
  });
});
