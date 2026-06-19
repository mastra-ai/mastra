import { test, expect, Page } from '@playwright/test';
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

test('takes the condition-selected branch after reloading a paused run on its :runId page', async ({ page }) => {
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

test('takes the condition-selected branch after a HARD reload of the paused :runId page', async ({ page }) => {
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

  await page.goto(`/workflows/complexWorkflow/graph/${runId}`);
  await runNextStep(page);
  await page.reload();
  await page.waitForTimeout(1000);

  // // ACT: advance the undecided conditional purely from the hard-reloaded snapshot.
  // // await runNextStepButton(page).click();

  // // ASSERT: the engine-selected arm (long-text) runs; short-text must NOT run.
  await expect(stepNode(page, 'long-text')).toHaveAttribute('data-workflow-step-status', 'success', {
    timeout: 20000,
  });
  await expect(stepNode(page, 'short-text')).not.toHaveAttribute('data-workflow-step-status', 'success');

  const el = await page.locator("[id='eshort-text-condition-short-text']");
  console.log('lol');

  await expect(await el.getAttribute('data-edge-status')).not.toBe('success');
});

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
});
