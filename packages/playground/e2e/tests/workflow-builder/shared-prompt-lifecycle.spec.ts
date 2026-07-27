import { expect, test } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';
import { canonicalWorkflowScenarios } from './workflow-builder-prompt-suite-oracle';

// FEATURE: Shared Workflow Builder prompt lifecycle
// USER STORY: A Studio user can submit each canonical comparison prompt and revisit the durably saved workflow.
// BEHAVIOR UNDER TEST: Streamed checkpoint/Finalize calls produce saveable definitions whose graph and chat survive reload.
test.describe('Workflow Builder shared prompt lifecycle', () => {
  test.setTimeout(90_000);

  for (const scenario of canonicalWorkflowScenarios) {
    test.describe(`when the ${scenario.id} prompt is submitted`, () => {
      test('persists the finalized workflow and authoring conversation across reload', async ({ page }) => {
        await resetStorage();
        await selectFixture(page, scenario.fixture);
        await page.goto('/workflow-builder/create');

        await page.getByTestId('workflow-builder-conversation-input').fill(scenario.prompt);
        await page.getByTestId('workflow-builder-conversation-submit').click();

        await expect(page.getByText(`Ready — ${scenario.id} is finalized.`)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText('Ready to save')).toBeVisible();
        await expect(page.getByTestId('workflow-definition-graph')).toContainText(scenario.expectedGraphEntry);

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForURL(`/workflow-builder/${scenario.id}`);
        await expect(page.getByText('Workflow saved')).toBeVisible();

        await page.reload();

        await expect(page.getByRole('heading', { name: scenario.id })).toBeVisible();
        await expect(page.getByTestId('workflow-definition-graph')).toContainText(scenario.expectedGraphEntry);
        await expect(page.getByText(scenario.prompt)).toBeVisible();
      });
    });
  }
});
