import { expect, test } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';
import { selectFixture } from '../__utils__/select-fixture';

const workflowId = 'support-intake-workflow';

// FEATURE: Persisted workflow authoring lifecycle
// USER STORY: A Studio user can build a workflow conversationally, save and revisit it, run it, and delete it.
test.describe('Persisted Workflow Builder', () => {
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    await resetStorage();
  });

  test.describe('when a permitted user describes a workflow to the editor-owned builder', () => {
    test('completes the persisted workflow Studio lifecycle', async ({ page }) => {
      await selectFixture(page, 'workflow-builder-lifecycle');
      await page.goto('/workflow-builder');
      await page.getByRole('link', { name: 'New workflow' }).click();
      await page.waitForURL('/workflow-builder/create');
      await expect(page.getByText('Not started')).toBeVisible();
      await expect(page.getByText('Workflow graph must contain at least one step.')).not.toBeVisible();

      await page.getByTestId('workflow-builder-conversation-input').fill('Create a support intake workflow.');
      await page.getByTestId('workflow-builder-conversation-submit').click();

      await expect(page.getByText(`Done — I created ${workflowId} with one mapping step.`)).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('Ready to save')).toBeVisible();
      await expect(page.getByTestId('workflow-definition-graph')).toContainText('answer-request');
      await expect(page.getByTestId('agent-builder-chat-generic-tool')).toContainText([
        'Completed checkpoint-workflow-draft',
        'Completed finalize-workflow-draft',
      ]);

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForURL(`/workflow-builder/${workflowId}`);
      await expect(page.getByText('Workflow saved')).toBeVisible();

      await page.reload();
      await expect(page.getByRole('heading', { name: workflowId })).toBeVisible();
      await expect(page.getByTestId('workflow-definition-graph')).toContainText('mapping');

      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await page.waitForURL(`/workflows/${workflowId}/graph`);

      await page.getByRole('textbox', { name: 'Prompt' }).fill('Describe the weather in New York');
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await expect(page.locator('[data-workflow-node]').first()).toHaveAttribute(
        'data-workflow-step-status',
        'success',
        {
          timeout: 30_000,
        },
      );

      await page.goto(`/workflow-builder/${workflowId}`);
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
      await page.waitForURL('/workflow-builder');
      await expect(page.getByText('No persisted workflows yet')).toBeVisible();
    });
  });
});
