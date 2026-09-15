import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Workflow debug "Run next step" branch selection on the run-detail (:runId) page
 * USER STORY: As a Studio user, I pause a per-step run right before a conditional, navigate
 *   away, then come back to that exact run by its URL and click "Run next step". The run must
 *   take the branch the condition actually selects — not a branch the UI guessed.
 * BUG UNDER TEST: When a paused run is rehydrated from its stored snapshot on the :runId page,
 *   neither conditional arm has a result yet, so the branch is undecided. The old behavior
 *   blindly targeted the FIRST arm in graph order (short-text), which forces the wrong branch
 *   when the condition would actually pick a different arm (long-text). The fix hands every arm
 *   id to core so the engine re-evaluates the condition and runs the correct arm.
 *
 * complexWorkflow's branch:
 *   text.length <= 10 -> short-text   (first arm in graph order)
 *   text.length  > 10 -> long-text    (second arm)
 * Input "HELLO" grows to 14 chars by the conditional, so the CORRECT arm is long-text.
 * The buggy "pick the first arm" logic would instead run short-text.
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

function stepNode(page: Page, stepKey: string) {
  return page.locator(`[data-workflow-node][data-workflow-step-key="${stepKey}"]`);
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

test.describe('Workflow debug conditional branch selection on the run-detail page', () => {
  test.describe('when a paused run is reopened by its :runId URL before the conditional', () => {
    test('takes the condition-selected branch after reloading the paused run', async ({ page }) => {
      // ARRANGE: start a per-step run with a LONG input so the conditional must take long-text.
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('textbox', { name: 'Text' }).fill('HELLO');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      // Advance up to (but not into) the conditional: add-letter, the parallel block, then the map.
      await runNextStep(page);
      await expectStepSuccess(page, 0); // add-letter

      await runNextStep(page);
      await expectStepSuccess(page, 1); // add-letter-b
      await expectStepSuccess(page, 2); // add-letter-c

      await runNextStep(page);
      await expectStepSuccess(page, 3); // map -> single text field; next step is the undecided branch

      // The run is now paused right before the conditional: neither branch arm has run yet.
      await expect(stepNode(page, 'short-text')).toHaveAttribute('data-workflow-step-status', 'idle');
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'idle');

      // Capture the paused run id and navigate AWAY then BACK to it (the user's exact repro).
      const recentRunLink = page.locator('a[href*="/workflows/complexWorkflow/graph/"]').first();
      await expect(recentRunLink).toBeVisible({ timeout: 20000 });
      const href = await recentRunLink.getAttribute('href');
      const runId = href?.split('/').pop();
      expect(runId, 'expected a runId in the recent-runs link href').toBeTruthy();

      await page.goto('/workflows');
      await page.goto(`/workflows/complexWorkflow/graph/${runId}`);

      // The per-step controls come back purely from the paused status (debug flag is OFF here).
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });
      await expectStepSuccess(page, 3);

      // ACT: advance the undecided conditional from the rehydrated snapshot.
      await runNextStepButton(page).click();

      // ASSERT: the engine-selected arm (long-text) runs; the guessed first arm (short-text)
      // must NOT run. This is the branch-selection bug lock.
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });
      await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success');
    });
  });

  test.describe('when the paused :runId page is hard-reloaded before the conditional', () => {
    test('takes the condition-selected branch after a HARD reload of the paused run', async ({ page }) => {
      // The user's exact repro: pause right before the conditional, HARD-refresh the run page so
      // ALL state is snapshot-derived, then click "Run next step" exactly once. The run must take
      // the condition-selected arm (long-text), not the first arm in graph order (short-text).
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('textbox', { name: 'Text' }).fill('HELLO');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      await runNextStep(page);
      await expectStepSuccess(page, 0); // add-letter

      await runNextStep(page);
      await expectStepSuccess(page, 1); // add-letter-b
      await expectStepSuccess(page, 2); // add-letter-c

      await runNextStep(page);
      await expectStepSuccess(page, 3); // map -> paused right before the conditional

      await expect(stepNode(page, 'short-text')).toHaveAttribute('data-workflow-step-status', 'idle');
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'idle');

      // Capture the run id, navigate to its :runId URL, then HARD reload so nothing is in memory.
      const recentRunLink = page.locator('a[href*="/workflows/complexWorkflow/graph/"]').first();
      await expect(recentRunLink).toBeVisible({ timeout: 20000 });
      const href = await recentRunLink.getAttribute('href');
      const runId = href?.split('/').pop();
      expect(runId, 'expected a runId in the recent-runs link href').toBeTruthy();

      // Navigate to the paused run page, advance the conditional, then HARD reload so the run
      // page rehydrates purely from the persisted snapshot.
      await page.goto(`/workflows/complexWorkflow/graph/${runId}`);
      await runNextStep(page);
      await page.reload();

      // The engine-selected arm (long-text) must be the one that ran; short-text never ran.
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });
      await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success');

      // The un-taken arm's incoming edge must stay neutral: short-text was skipped, so the run
      // never flowed through it even though the snapshot carries a status for the step.
      const skippedArmEdge = page.locator('[data-edge-to="short-text"]').first();
      await expect(skippedArmEdge).toHaveAttribute('data-edge-status', 'idle');
    });
  });

  test.describe('when the paused :runId page is reloaded before and after the conditional', () => {
    test('takes the condition-selected branch when the conditional is reloaded then advanced', async ({ page }) => {
      // The user's "even better" repro: pause right before the conditional, navigate to the run
      // page, HARD reload, advance once (long-text), then HARD reload AGAIN and advance once more.
      // Each advance off a freshly rehydrated snapshot must keep taking the condition-selected arm.
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('textbox', { name: 'Text' }).fill('HELLO');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      await runNextStep(page);
      await expectStepSuccess(page, 0); // add-letter

      await runNextStep(page);
      await expectStepSuccess(page, 1); // add-letter-b
      await expectStepSuccess(page, 2); // add-letter-c

      await runNextStep(page);
      await expectStepSuccess(page, 3); // map -> paused right before the conditional

      const recentRunLink = page.locator('a[href*="/workflows/complexWorkflow/graph/"]').first();
      await expect(recentRunLink).toBeVisible({ timeout: 20000 });
      const href = await recentRunLink.getAttribute('href');
      const runId = href?.split('/').pop();
      expect(runId, 'expected a runId in the recent-runs link href').toBeTruthy();

      // Land on the run page and HARD reload before advancing the conditional.
      await page.goto(`/workflows/complexWorkflow/graph/${runId}`);
      await page.reload();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });
      await expectStepSuccess(page, 3);

      // First advance off the rehydrated snapshot -> must take long-text.
      await runNextStepButton(page).click();
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });
      await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success');

      // HARD reload AGAIN, now paused right AFTER the conditional, and advance once more. The
      // condition selection persisted in the snapshot must survive the reload + next click.
      await page.reload();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });
      await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success');

      await runNextStepButton(page).click();

      // After advancing past the conditional, short-text must STILL never have run.
      await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });
    });
  });

  test.describe('when the conditional is advanced on the live graph page', () => {
    test('takes the condition-selected branch on the live graph page (no reload)', async ({ page }) => {
      // Same long input, but advance the conditional on the LIVE graph page without navigating
      // away. This isolates whether the conditional re-evaluation works in the live stream path,
      // separate from snapshot rehydration on the :runId page.
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('textbox', { name: 'Text' }).fill('HELLO');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      await runNextStep(page);
      await expectStepSuccess(page, 0); // add-letter

      await runNextStep(page);
      await expectStepSuccess(page, 1); // add-letter-b
      await expectStepSuccess(page, 2); // add-letter-c

      await runNextStep(page);
      await expectStepSuccess(page, 3); // map

      await expect(stepNode(page, 'short-text')).toHaveAttribute('data-workflow-step-status', 'idle');
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'idle');

      // ACT: advance the undecided conditional live.
      await runNextStepButton(page).click();

      // ASSERT: long-text runs, short-text does not.
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });
      await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success');

      await runNextStep(page);
    });
  });

  test.describe('when a debug run finishes after taking the condition-selected branch', () => {
    test('marks branch and final edges successful', async ({ page }) => {
      // Drive complexWorkflow per-step all the way to a successful finish, then verify
      // both the post-branch map -> nested edge AND the boundary edge into the End node
      // are colored green. The End edge has no step ids, so it can only light once the
      // whole run reaches `success` (after the suspend boundary is resumed).
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('textbox', { name: 'Text' }).fill('HELLO');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      await runNextStep(page); // add-letter
      await expectStepSuccess(page, 0);

      await runNextStep(page); // parallel: add-letter-b + add-letter-c
      await expectStepSuccess(page, 1);
      await expectStepSuccess(page, 2);

      await runNextStep(page); // post-parallel map
      await expectStepSuccess(page, 3);

      await runNextStep(page); // conditional arm (long-text for "HELLO")
      await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
        timeout: 20000,
      });

      await runNextStep(page); // post-branch map
      await expectStepSuccess(page, 8);

      // Nested workflow runs atomically; this advance also runs the doUntil body and
      // stops at the suspend boundary (step 12).
      const nestedButton = runNextStepButton(page);
      await expect(nestedButton).toBeEnabled({ timeout: 20000 });
      await nestedButton.click();
      await expectStepSuccess(page, 9); // nested-text-processor
      await expectStepSuccess(page, 10); // add-letter-with-count
      await expect(nodes(page).nth(12)).toHaveAttribute('data-workflow-step-status', 'suspended', { timeout: 20000 });

      // Resume the suspended step so the run can finish.
      const suspendedSteps = page.getByTestId('workflow-suspended-steps');
      await suspendedSteps.getByRole('textbox', { name: 'User Input' }).fill('Hello');
      await suspendedSteps.getByRole('button', { name: 'Resume' }).click();
      await expectStepSuccess(page, 12); // suspend-resume

      // Final step finishes the whole run.
      const finalButton = runNextStepButton(page);
      await expect(finalButton).toBeEnabled({ timeout: 20000 });
      await finalButton.click();
      await expectStepSuccess(page, 13); // final-step

      // The post-branch map step serializes to a synthetic `mapping_<uuid>` id that
      // changes per build, so resolve it from the DOM. complexWorkflow has two `.map()`
      // steps; the SECOND mapping node is the post-branch join that feeds the nested workflow.
      const mappingNodes = page.locator('[data-workflow-node][data-workflow-step-key^="mapping_"]');
      await expect(mappingNodes).toHaveCount(2, { timeout: 20000 });
      const mapBranch = await mappingNodes.nth(1).getAttribute('data-workflow-step-key');
      expect(mapBranch).toBeTruthy();

      const edgeMap = page.locator(`[data-edge-from="${mapBranch}"][data-edge-to="nested-text-processor"]`).first();
      // The workflow-output boundary edge carries no step ids, so target it by its
      // domain-prefixed React Flow id: edge-boundary-<sourceNodeId>-boundary-end.
      const finalEdge = page.locator('[id="edge-boundary-node-final-step-boundary-end"]').first();

      await expect(edgeMap).toHaveAttribute('data-edge-status', 'success', { timeout: 20000 });
      await expect(finalEdge).toHaveAttribute('data-edge-status', 'success', { timeout: 20000 });
    });
  });
});
