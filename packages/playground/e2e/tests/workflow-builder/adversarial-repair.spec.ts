import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';
import type { Fixtures } from '../__utils__/select-fixture';
import { getCanonicalWorkflowScenario } from './workflow-builder-prompt-suite-oracle';
import type { CanonicalWorkflowScenarioId } from './workflow-builder-prompt-suite-oracle';

const adversarialScenarios = [
  { id: 'customer-ticket-workflow', fixture: 'workflow-builder-adversarial-customer-ticket' },
  { id: 'parallel-customer-lookup-workflow', fixture: 'workflow-builder-adversarial-parallel-lookup' },
  { id: 'priority-support-router', fixture: 'workflow-builder-adversarial-priority-router' },
  { id: 'mixed-support-pipeline', fixture: 'workflow-builder-adversarial-mixed-pipeline' },
] as const satisfies ReadonlyArray<{ id: CanonicalWorkflowScenarioId; fixture: Fixtures }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getRunOutput = async (page: Page, workflowId: CanonicalWorkflowScenarioId, runInput: unknown) => {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForURL(`/workflows/${workflowId}/graph`);
  await page.getByRole('radio', { name: 'JSON' }).click();
  await page.locator('.cm-content').fill(JSON.stringify(runInput));
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('[data-workflow-node][data-workflow-step-status="success"]').first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Run output' }).click();

  const output = JSON.parse(await page.getByRole('dialog').locator('.cm-content').innerText());
  if (!isRecord(output) || !('result' in output)) {
    throw new Error(`Workflow ${workflowId} did not expose a run result.`);
  }

  return output.result;
};

// FEATURE: Workflow Builder adversarial repair journeys
// USER STORY: A Studio user can recover a valid accepted draft after strict validation rejects a complex workflow.
// BEHAVIOR UNDER TEST: An invalid complete submission returns diagnostics without touching accepted state; the
// corrected whole-definition resubmission becomes Ready before explicit Save.
test.describe('Workflow Builder adversarial repair journeys', () => {
  test.setTimeout(90_000);

  for (const { id: workflowId, fixture } of adversarialScenarios) {
    test.describe(`when ${workflowId} requires targeted repair`, () => {
      test('repairs, finalizes, saves, restores, and produces the canonical result', async ({ page }) => {
        const scenario = getCanonicalWorkflowScenario(workflowId);

        await resetStorage();
        await selectFixture(page, fixture);
        await page.goto('/workflow-builder/create');
        await page.getByTestId('workflow-builder-conversation-input').fill(scenario.prompt);
        await page.getByTestId('workflow-builder-conversation-submit').click();

        await expect(page.getByText(`Ready — ${workflowId} repaired and finalized.`)).toBeVisible({ timeout: 30_000 });
        const save = page.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toBeEnabled({ timeout: 30_000 });
        await save.click();
        await page.waitForURL(`/workflow-builder/${workflowId}`);
        await page.reload();
        await expect(page.getByRole('heading', { name: workflowId })).toBeVisible();
        await expect(page.getByText(scenario.prompt)).toBeVisible();

        const output = await getRunOutput(page, workflowId, scenario.runInput);
        expect(scenario.assertOutput(output), JSON.stringify(output)).toBe(true);
      });
    });
  }
});
