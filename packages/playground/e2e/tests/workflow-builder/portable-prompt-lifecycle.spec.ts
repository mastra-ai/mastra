import { expect, test } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';
import { portableWorkflowScenarios } from './workflow-builder-portable-prompt-suite';

// FEATURE: Portable Workflow Builder prompt lifecycle
// USER STORY: A Studio user can author and revisit workflows that do not depend on the instance registry.
// BEHAVIOR UNDER TEST: Portable mapping-only definitions finalize, persist, and restore their authoring conversation.
test.describe('Workflow Builder portable prompt lifecycle', () => {
  test.setTimeout(90_000);

  for (const scenario of portableWorkflowScenarios) {
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

      test('executes the saved workflow and returns the output the prompt asked for', async ({ page, request }) => {
        await resetStorage();
        await selectFixture(page, scenario.fixture);
        await page.goto('/workflow-builder/create');

        await page.getByTestId('workflow-builder-conversation-input').fill(scenario.prompt);
        await page.getByTestId('workflow-builder-conversation-submit').click();

        await expect(page.getByText(`Ready — ${scenario.id} is finalized.`)).toBeVisible({ timeout: 30_000 });
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Workflow saved')).toBeVisible();

        const response = await request.post(`/api/workflows/${scenario.id}/start-async`, {
          data: { inputData: scenario.runInput },
        });

        expect(response.ok(), `start-async failed: ${response.status()} ${await response.text()}`).toBe(true);

        const body = await response.json();
        expect(body.status, `run did not succeed: ${JSON.stringify(body)}`).toBe('success');
        expect(scenario.assertOutput(body.result), `unexpected workflow output: ${JSON.stringify(body.result)}`).toBe(
          true,
        );
      });
    });
  }
});
