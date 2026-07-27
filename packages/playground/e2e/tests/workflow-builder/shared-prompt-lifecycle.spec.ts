import { expect, test } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';
import promptSuite from './workflow-builder-prompt-suite.json' with { type: 'json' };

const scenarios = [
  {
    id: 'addition-workflow',
    fixture: 'workflow-builder-prompt-addition',
    expectedGraphEntry: 'add-numbers-result',
  },
  {
    id: 'customer-ticket-workflow',
    fixture: 'workflow-builder-prompt-customer-ticket',
    expectedGraphEntry: 'ticket-result',
  },
  {
    id: 'parallel-customer-lookup-workflow',
    fixture: 'workflow-builder-prompt-parallel-customer-lookup',
    expectedGraphEntry: 'parallel-customer-results',
  },
  {
    id: 'support-answer-workflow',
    fixture: 'workflow-builder-prompt-support-answer',
    expectedGraphEntry: 'support-answer-result',
  },
  {
    id: 'nested-greeting-workflow',
    fixture: 'workflow-builder-prompt-nested-greeting',
    expectedGraphEntry: 'nested-greeting-result',
  },
  {
    id: 'foreach-customer-lookup-workflow',
    fixture: 'workflow-builder-prompt-foreach-customer-lookup',
    expectedGraphEntry: 'lookup-customer-item',
  },
  {
    id: 'priority-support-router',
    fixture: 'workflow-builder-prompt-priority-support-router',
    expectedGraphEntry: 'priority-support-result',
  },
  {
    id: 'mixed-support-pipeline',
    fixture: 'workflow-builder-prompt-mixed-support-pipeline',
    expectedGraphEntry: 'mixed-support-result',
  },
] as const;

// FEATURE: Shared Workflow Builder prompt lifecycle
// USER STORY: A Studio user can submit each canonical comparison prompt and revisit the durably saved workflow.
// BEHAVIOR UNDER TEST: Streamed checkpoint/Finalize calls produce saveable definitions whose graph and chat survive reload.
test.describe('Workflow Builder shared prompt lifecycle', () => {
  test.setTimeout(90_000);

  for (const scenario of scenarios) {
    test.describe(`when the ${scenario.id} prompt is submitted`, () => {
      test('persists the finalized workflow and authoring conversation across reload', async ({ page }) => {
        await resetStorage();
        await selectFixture(page, scenario.fixture);
        await page.goto('/workflow-builder/create');

        const manifestScenario = promptSuite.scenarios.find(item => item.id === scenario.id);
        if (!manifestScenario) {
          throw new Error(`Missing shared prompt manifest entry for ${scenario.id}`);
        }

        await page.getByTestId('workflow-builder-conversation-input').fill(manifestScenario.prompt);
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
        await expect(page.getByText(manifestScenario.prompt)).toBeVisible();
      });
    });
  }
});
