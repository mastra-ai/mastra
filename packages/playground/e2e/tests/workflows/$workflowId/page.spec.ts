import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';
import { topLevelWorkflowNodes } from '../../__utils__/workflow-nodes';

test.describe('Workflow graph detail page', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows/complexWorkflow/graph');
  });

  test.describe('when the complex-workflow graph is opened', () => {
    test('overall layout information', async ({ page }) => {
      await expect(page).toHaveTitle(/Mastra Studio/);
      const breadcrumb = page.locator('header>nav');
      await expect(breadcrumb).toMatchAriaSnapshot();

      await expect(page.getByText('complex-workflow').first()).toBeVisible();
      await expect(page.getByRole('combobox').filter({ hasText: 'complex-workflow' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Form' })).toBeChecked();
      await expect(page.getByRole('radio', { name: 'JSON' })).not.toBeChecked();

      await expect(page.getByRole('textbox', { name: 'Text' })).toBeVisible();
      await expect(getRunButton(page)).toBeVisible();

      await page.getByRole('radio', { name: 'JSON' }).click();
      const codeEditor = await page.locator('[contenteditable="true"]');
      await expect(codeEditor).toBeVisible();
      await expect(codeEditor).toContainText('"text": ""');
      await expect(codeEditor).toHaveAttribute('data-language', 'json');
    });

    test('initial workflow run state', async ({ page }) => {
      const nodes = await topLevelWorkflowNodes(page);
      await expect(nodes).toHaveCount(14);

      await expect(nodes.nth(0)).toContainText('add-letter');
      await expect(nodes.nth(1)).toContainText('add-letter-b');
      await expect(nodes.nth(2)).toContainText('add-letter-c');
      await expect(nodes.nth(3)).toContainText('Map');
      await expect(nodes.nth(4)).toContainText('When');
      await expect(nodes.nth(5)).toContainText('short-text');
      await expect(nodes.nth(6)).toContainText('When');
      await expect(nodes.nth(7)).toContainText('long-text');
      await expect(nodes.nth(8)).toContainText('Map');
      await expect(nodes.nth(9)).toContainText('nested-text-processor');
      await expect(nodes.nth(10)).toContainText('add-letter-with-count');
      await expect(nodes.nth(11)).toContainText('Do until');
      await expect(nodes.nth(12)).toContainText('suspend-resume');
      await expect(nodes.nth(13)).toContainText('final-step');
    });
  });

  test.describe('when the workflow is run via the form with a short-condition input', () => {
    test('takes the short path and suspends for user input', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Text' }).fill('A');
      await getRunButton(page).click();

      await runWorkflow(page);
      await checkShortPath(page);
    });
  });

  test.describe('when the workflow is run via the form with multiline input', () => {
    test('preserves the newline and takes the long path', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Text' }).fill('1234567890\n');
      await getRunButton(page).click();

      await runWorkflow(page);
      await checkLongPath(page);
    });
  });

  test.describe('when the workflow is run via JSON with a short-condition input', () => {
    test('takes the short path and suspends for user input', async ({ page }) => {
      await page.getByRole('radio', { name: 'JSON' }).click();
      await page.locator('.cm-content').fill('{"text":"A"}');
      await getRunButton(page).click();

      await runWorkflow(page);
      await checkShortPath(page);
    });
  });

  test.describe('when the workflow is run via JSON with a long-condition input', () => {
    test('takes the long path and suspends for user input', async ({ page }) => {
      await page.getByRole('radio', { name: 'JSON' }).click();
      await page.locator('.cm-content').fill('{"text":"SuperLongTextToStartWith"}');
      await getRunButton(page).click();

      await runWorkflow(page);
      await checkLongPath(page);
    });
  });

  test.describe('when a workflow with an enum input is run with a selected option', () => {
    test('uses the selected form value in the workflow output', async ({ page }) => {
      await page.goto('/workflows/enumWorkflow/graph');

      await page.getByRole('combobox', { name: 'Mode' }).click();
      await page.getByRole('option', { name: 'b' }).click();

      await expect(page.getByRole('combobox', { name: 'Mode' })).toContainText('b');

      await getRunButton(page).click();

      const nodes = topLevelWorkflowNodes(page);
      await expect(nodes.nth(0)).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 20000 });

      await page.getByRole('button', { name: 'Run data' }).click();
      await expect(page.getByTestId('workflow-run-data')).toContainText('"mode": "b"');
    });
  });

  test.describe('when a completed run is selected from the canvas', () => {
    test('keeps the chosen camera while displaying the saved run', async ({ page }) => {
      await page.goto('/workflows/enumWorkflow/graph');
      await getRunButton(page).click();
      await expect(topLevelWorkflowNodes(page).nth(0)).toHaveAttribute('data-workflow-step-status', 'success');

      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      await expect(page.getByRole('slider', { name: 'Canvas zoom' })).toHaveAttribute('aria-valuenow', '1.2');
      const viewport = page.locator('.react-flow__viewport');
      const camera = await viewport.evaluate(element => getComputedStyle(element).transform);
      const recentRun = page.locator('a[href*="/workflows/enumWorkflow/graph/"]');
      await expect(recentRun).toHaveCount(1);
      await recentRun.click();

      await expect(page).toHaveURL(/\/workflows\/enumWorkflow\/graph\/[^/]+$/);
      await expect(getRunButton(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Run data', exact: true })).toBeVisible();
      await expect(viewport).toHaveCSS('transform', camera);
    });
  });

  test.describe('when a suspended workflow is resumed with user input', () => {
    test('completes the suspended and final steps', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Text' }).fill('A');
      await getRunButton(page).click();
      await runWorkflow(page);

      const suspendedSteps = page.getByTestId('workflow-suspended-steps');
      await suspendedSteps.getByRole('textbox', { name: 'User Input' }).fill('Hello');
      await suspendedSteps.getByRole('button', { name: 'Resume' }).click();
      const nodes = await topLevelWorkflowNodes(page);

      await expect(nodes.nth(12)).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 20000 });
      await expect(nodes.nth(13)).toHaveAttribute('data-workflow-step-status', 'success');
    });
  });
});

function getRunButton(page: Page) {
  return page.getByRole('button', { name: 'Run', exact: true });
}

async function checkShortPath(page: Page) {
  const nodes = await topLevelWorkflowNodes(page);

  await expect(nodes.nth(5)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(7)).toHaveAttribute('data-workflow-step-status', 'idle');
  await expect(page.getByTestId('workflow-suspended-steps')).toContainText('Step suspended');
  await page
    .getByTestId('workflow-suspended-steps')
    .getByRole('button', { name: /suspend-resume|reason/ })
    .click();
  await expect(page.locator('[data-testid="suspended-payload"]').locator('[role="textbox"]')).toContainText(
    `"reason": "Please provide user input to continue"`,
  );
}

async function checkLongPath(page: Page) {
  const nodes = await topLevelWorkflowNodes(page);

  await expect(nodes.nth(5)).toHaveAttribute('data-workflow-step-status', 'idle');
  await expect(nodes.nth(7)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.getByTestId('workflow-suspended-steps')).toContainText('Step suspended');
  await page
    .getByTestId('workflow-suspended-steps')
    .getByRole('button', { name: /suspend-resume|reason/ })
    .click();
  await expect(page.locator('[data-testid="suspended-payload"]').locator('[role="textbox"]')).toContainText(
    `"reason": "Please provide user input to continue"`,
  );
}

async function runWorkflow(page: Page) {
  const nodes = await topLevelWorkflowNodes(page);

  await expect(nodes.nth(0)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(1)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(2)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(3)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(8)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(9)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(10)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(11)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(12)).toHaveAttribute('data-workflow-step-status', 'suspended');
  await expect(nodes.nth(13)).toHaveAttribute('data-workflow-step-status', 'idle');
}
