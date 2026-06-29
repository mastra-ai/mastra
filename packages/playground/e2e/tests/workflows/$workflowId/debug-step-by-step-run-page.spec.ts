import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Workflow debug mode "Run next step" on the run-detail (:runId) page
 * USER STORY: As a Studio user, when I open a paused run directly by its URL
 *   (e.g. from the recent-runs list or a shared link), I want the same per-step
 *   debug controls I get on the graph page — without having to re-toggle "Debug".
 * BEHAVIOR UNDER TEST: A run only reaches the `paused` status when it was started
 *   in per-step (debug) mode. The :runId page starts with the in-memory debug flag
 *   OFF, so the step controls must be driven purely by the run's paused status.
 *   Landing on a paused run's URL must:
 *     - show the "Run next step" controls,
 *     - keep the run-input form collapsed (read-only),
 *     - and let the user advance the run one step further.
 *
 * This is a behavior lock for the runId-page per-step flow. It deliberately does a
 * fresh navigation to the run URL so the controls cannot rely on the toggle state
 * left over from starting the run.
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
  await expect(button).toBeEnabled({ timeout: 20000 });
}

test.describe('Workflow debug per-step controls on the run-detail page', () => {
  test.describe("when landing directly on a paused run's :runId page", () => {
    test('shows per-step controls and advances the paused run', async ({ page }) => {
      // ARRANGE: start a per-step run on the graph page and advance one step so the run
      // is genuinely paused mid-flow (add-letter done, parallel block still pending).
      await page.goto('/workflows/complexWorkflow/graph');
      await page.getByRole('textbox', { name: 'Text' }).fill('A');
      await page.getByRole('switch', { name: 'Debug' }).click();
      await expect(page.getByRole('switch', { name: 'Debug' })).toBeChecked();

      await runButton(page).click();
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      // Advance the first step so the run has visible progress to verify after reload.
      await runNextStep(page);
      await expectStepSuccess(page, 0);

      // Capture the paused run's id from the recent-runs link, then navigate directly to
      // its :runId page in a fresh navigation (no leftover in-memory debug toggle).
      const recentRunLink = page.locator('a[href*="/workflows/complexWorkflow/graph/"]').first();
      await expect(recentRunLink).toBeVisible({ timeout: 20000 });
      const href = await recentRunLink.getAttribute('href');
      const runId = href?.split('/').pop();
      expect(runId, 'expected a runId in the recent-runs link href').toBeTruthy();

      // ACT: land on the paused run's page directly. Debug mode is OFF in memory here.
      await page.goto(`/workflows/complexWorkflow/graph/${runId}`);

      // ASSERT: the per-step controls appear purely from the paused status — no toggle needed.
      await expect(page.locator(DEBUG_CONTROLS)).toBeVisible({ timeout: 20000 });

      // The run-input form is collapsed/read-only while viewing a paused run: only the
      // "Run input" button is present, not the editable text field / "Run" button.
      await expect(page.getByRole('button', { name: 'Run input' })).toBeVisible({ timeout: 20000 });
      await expect(runButton(page)).toHaveCount(0);

      // The first step's success is still reflected on the run page.
      await expectStepSuccess(page, 0);

      // ASSERT: advancing from the run page works just like the graph page.
      // Steps 1 & 2: the parallel block (add-letter-b, add-letter-c).
      await runNextStep(page);
      await expectStepSuccess(page, 1);
      await expectStepSuccess(page, 2);

      // Step 3: map back to single text field.
      await runNextStep(page);
      await expectStepSuccess(page, 3);

      // Step 5: short-text branch (input "A" -> short path).
      await runNextStep(page);
      await expectStepSuccess(page, 5);

      // Step 8: map back after the branch.
      await runNextStep(page);
      await expectStepSuccess(page, 8);

      // Step 9: nested-text-processor runs atomically and carries through the doUntil body,
      // stopping at the suspend/resume step (the human-in-the-loop boundary).
      const advanceToSuspend = runNextStepButton(page);
      await expect(advanceToSuspend).toBeEnabled({ timeout: 20000 });
      await advanceToSuspend.click();
      await expectStepSuccess(page, 9);
      await expectStepSuccess(page, 10);

      // ...and stops at suspend-resume, which suspends the run for user input.
      await expect(nodes(page).nth(12)).toHaveAttribute('data-workflow-step-status', 'suspended', { timeout: 20000 });

      // BUG LOCK: on the :runId page the suspend dialog must surface so the user can enter
      // resume data. The stored run snapshot lags behind the live suspended status, so the
      // overlay must key off the live result — otherwise the dialog never appears here.
      const suspendedSteps = page.getByTestId('workflow-suspended-steps');
      await expect(suspendedSteps).toBeVisible({ timeout: 20000 });

      // Resuming from the run page completes the suspended step just like the graph page.
      await suspendedSteps.getByRole('textbox', { name: 'User Input' }).fill('Hello');
      await suspendedSteps.getByRole('button', { name: 'Resume' }).click();
      await expectStepSuccess(page, 12);
    });
  });
});
