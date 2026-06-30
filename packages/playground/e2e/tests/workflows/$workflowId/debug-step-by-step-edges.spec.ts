import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { expectExactEdgeStatuses } from '../../__utils__/workflow-edges';
import type { EdgeExpectation } from '../../__utils__/workflow-edges';

/**
 * FEATURE: Workflow debug mode "Run next step" — deterministic edge activation.
 * USER STORY: As a Studio user advancing a workflow one step at a time, I want the
 *   graph to honestly represent the path the data took: an edge is green only when
 *   data actually flowed along that transition, and every un-taken branch stays neutral.
 * BEHAVIOR UNDER TEST: After a full per-step run of complexWorkflow we assert the
 *   COMPLETE, deterministic edge map — EVERY single edge the run should (or should not)
 *   take, for BOTH conditional branches:
 *     - input "A"     -> short-text branch (text.length <= 10)
 *     - input "HELLO" -> long-text branch  (text.length  > 10)
 *
 * Edge state is exposed via data attributes on each edge path:
 *   data-edge-from (source step id), data-edge-to (target step id),
 *   data-edge-status ("success" = data flowed | "idle" = neutral).
 * Note: a conditional renders multiple DOM edges for one logical transition that share
 * the same (from -> to); the helper asserts EVERY rendered edge in each pair.
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

/**
 * The two `.map()` steps serialize to synthetic `mapping_<uuid>` ids that change per
 * build. Resolve them from the DOM by position: the FIRST mapping node is the
 * post-parallel join, the SECOND is the post-branch join.
 */
async function resolveMappingIds(page: Page): Promise<{ mapParallel: string; mapBranch: string }> {
  const mappingNodes = page.locator('[data-workflow-node][data-workflow-step-key^="mapping_"]');
  await expect(mappingNodes).toHaveCount(2, { timeout: 20000 });
  const mapParallel = await mappingNodes.nth(0).getAttribute('data-workflow-step-key');
  const mapBranch = await mappingNodes.nth(1).getAttribute('data-workflow-step-key');
  expect(mapParallel).toBeTruthy();
  expect(mapBranch).toBeTruthy();
  return { mapParallel: mapParallel!, mapBranch: mapBranch! };
}

/**
 * Build the COMPLETE deterministic edge map for a finished complexWorkflow run.
 * `taken` is the branch arm the run flowed through; `untaken` is the other arm,
 * whose incoming AND outgoing edges must all stay idle.
 */
function expectedEdges(
  mapParallel: string,
  mapBranch: string,
  taken: 'short-text' | 'long-text',
  untaken: 'short-text' | 'long-text',
): EdgeExpectation[] {
  return [
    // start -> add-letter -> parallel block
    { from: 'add-letter', to: 'add-letter-b', status: 'success' },
    { from: 'add-letter', to: 'add-letter-c', status: 'success' },
    // parallel arms -> post-parallel map
    { from: 'add-letter-b', to: mapParallel, status: 'success' },
    { from: 'add-letter-c', to: mapParallel, status: 'success' },
    // post-parallel map -> conditional arms (taken arm green, un-taken arm idle)
    { from: mapParallel, to: taken, status: 'success' },
    { from: mapParallel, to: untaken, status: 'idle' },
    // conditional arms -> post-branch map (taken arm green, un-taken arm idle)
    { from: taken, to: mapBranch, status: 'success' },
    { from: untaken, to: mapBranch, status: 'idle' },
    // post-branch map -> nested workflow -> add-letter-with-count -> suspend -> final
    { from: mapBranch, to: 'nested-text-processor', status: 'success' },
    { from: 'nested-text-processor', to: 'add-letter-with-count', status: 'success' },
    { from: 'add-letter-with-count', to: 'suspend-resume', status: 'success' },
    { from: 'suspend-resume', to: 'final-step', status: 'success' },
  ];
}

async function driveFullRun(page: Page, takenArm: 'short-text' | 'long-text') {
  await runNextStep(page); // add-letter
  await expectStepSuccess(page, 0);

  await runNextStep(page); // parallel: add-letter-b + add-letter-c
  await expectStepSuccess(page, 1);
  await expectStepSuccess(page, 2);

  await runNextStep(page); // post-parallel map
  await expectStepSuccess(page, 3);

  await runNextStep(page); // conditional arm
  await expect(stepNode(page, takenArm)).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 20000 });

  await runNextStep(page); // post-branch map
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
}

test.describe('Workflow debug edge coloring', () => {
  test.describe('when a debug run takes the short-text branch', () => {
    test('colors every edge of the short-text branch run deterministically', async ({ page }) => {
      await page.goto('/workflows/complexWorkflow/graph');

      // ARRANGE: input "A" keeps text short, so the conditional takes short-text.
      await page.getByRole('textbox', { name: 'Text' }).fill('A');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      // ACT: start per-step, then drive every step to completion.
      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });
      await driveFullRun(page, 'short-text');

      // ASSERT: the COMPLETE edge map for the short-text path.
      await expect(page.locator('[data-edge-to="add-letter"]')).toHaveAttribute('data-edge-status', 'success');
      const { mapParallel, mapBranch } = await resolveMappingIds(page);
      await expectExactEdgeStatuses(page, expectedEdges(mapParallel, mapBranch, 'short-text', 'long-text'));
    });
  });

  test.describe('when a debug run takes the long-text branch', () => {
    test('colors every edge of the long-text branch run deterministically', async ({ page }) => {
      await page.goto('/workflows/complexWorkflow/graph');

      // ARRANGE: input "HELLO" grows past 10 chars by the conditional -> long-text arm.
      await page.getByRole('textbox', { name: 'Text' }).fill('HELLO');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });
      await driveFullRun(page, 'long-text');

      // ASSERT: the COMPLETE edge map for the long-text path (mirror of short-text).
      await expect(page.locator('[data-edge-to="add-letter"]')).toHaveAttribute('data-edge-status', 'success');
      const { mapParallel, mapBranch } = await resolveMappingIds(page);
      await expectExactEdgeStatuses(page, expectedEdges(mapParallel, mapBranch, 'long-text', 'short-text'));
    });
  });
});
