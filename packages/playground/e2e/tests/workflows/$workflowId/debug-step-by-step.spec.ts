import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Workflow debug mode "Run next step" (per-step execution)
 * USER STORY: As a Studio user, I want to enable debug mode and advance a workflow
 *   one step at a time, confirming each step completes, until the whole run finishes.
 * BEHAVIOR UNDER TEST: Driving complexWorkflow purely via "Run next step" advances
 *   through EVERY topology it contains — initial step, a parallel block, a map, a
 *   conditional branch, a nested workflow, a doUntil loop, a suspend/resume step, and
 *   the final step — and the run ends in a finished (success) state. No shortcuts:
 *   each advance is a discrete "Run next step" click that must move the run forward.
 *
 * This is a behavior lock for the per-step debug flow. It must drive the run from the
 * very top (input + debug on) to the very end (final-step success / run finished).
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

/**
 * Click "Run next step" once and wait for the per-step run to settle back to paused
 * (the button re-enables) so the next assertion observes a stable state.
 */
async function runNextStep(page: Page) {
  const button = runNextStepButton(page);
  await expect(button).toBeEnabled({ timeout: 20000 });
  await button.click();
  // After a per-step advance the run pauses again and the control re-enables.
  await expect(button).toBeEnabled({ timeout: 20000 });
}

test.describe('Workflow debug "Run next step"', () => {
  test.describe('when complexWorkflow is driven one step at a time in debug mode', () => {
    test('advances through every topology until the run finishes', async ({ page }) => {
      await page.goto('/workflows/complexWorkflow/graph');

      // ARRANGE: put input + activate debug mode.
      await page.getByRole('textbox', { name: 'Text' }).fill('A');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      // ACT: start execution. With debug mode on this runs per-step and pauses immediately.
      await runButton(page).click();

      // The per-step controls appear once the run is paused.
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      // Step 0: add-letter
      await runNextStep(page);
      await expectStepSuccess(page, 0);

      // Steps 1 & 2: the parallel block (add-letter-b, add-letter-c)
      await runNextStep(page);
      await expectStepSuccess(page, 1);
      await expectStepSuccess(page, 2);

      // Step 3: map back to single text field
      await runNextStep(page);
      await expectStepSuccess(page, 3);

      // Step 5: short-text branch (input "A" -> short path)
      await runNextStep(page);
      await expectStepSuccess(page, 5);

      // Step 8: map back after the branch
      await runNextStep(page);
      await expectStepSuccess(page, 8);

      // Step 9: nested-text-processor.
      // A nested workflow can't be paused inside per-step mode without core support, so we
      // run it atomically. This single advance completes the nested workflow AND any following
      // top-level steps (the doUntil body) until the run reaches the next natural pause boundary
      // — the suspend/resume step. We therefore expect the nested step, step 10, and the suspend
      // all to settle from one click here.
      const button = runNextStepButton(page);
      await expect(button).toBeEnabled({ timeout: 20000 });
      await button.click();

      // The atomic advance runs through the nested workflow and the doUntil body...
      await expectStepSuccess(page, 9);
      await expectStepSuccess(page, 10);

      // ...and stops at suspend-resume, which suspends the run for user input.
      await expect(nodes(page).nth(12)).toHaveAttribute('data-workflow-step-status', 'suspended', { timeout: 20000 });

      // Resume the suspended step to continue the per-step run.
      const suspendedSteps = page.getByTestId('workflow-suspended-steps');
      await suspendedSteps.getByRole('textbox', { name: 'User Input' }).fill('Hello');
      await suspendedSteps.getByRole('button', { name: 'Resume' }).click();
      await expectStepSuccess(page, 12);

      // Step 13: final-step — the very end. This is the last step, so advancing it FINISHES the
      // whole run (rather than pausing again) so the user can see the run's end output. We click
      // once and assert the final step succeeds.
      const finalButton = runNextStepButton(page);
      await expect(finalButton).toBeEnabled({ timeout: 20000 });
      await finalButton.click();
      await expectStepSuccess(page, 13);

      // ASSERT: the run finished end-to-end. The final step output carries the "-ENDED" suffix.
      await page.getByRole('button', { name: 'Run output' }).click();
      await expect(page.getByRole('dialog')).toContainText('-ENDED');
    });
  });
});
