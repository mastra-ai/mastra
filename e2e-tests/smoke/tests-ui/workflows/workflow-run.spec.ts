import { test, expect, Page } from '@playwright/test';

/**
 * Get workflow step statuses by reading attributes and extracting the step name
 * from the full text content (first word, which is the kebab-case step name).
 */
async function getStepStatuses(page: Page): Promise<{ name: string; status: string }[]> {
  return page.$$eval('[data-workflow-node]', nodes =>
    nodes.map(n => {
      // Full text looks like "add-greeting 3ms Time travel Input Output"
      // The step name is always the first whitespace-separated token
      const fullText = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      const firstToken = fullText.split(' ')[0].toLowerCase();
      return {
        name: firstToken,
        status: n.getAttribute('data-workflow-step-status') ?? 'unknown',
      };
    }),
  );
}

/**
 * Assert all steps have the expected status, with per-step failure messages.
 */
function expectAllSteps(steps: { name: string; status: string }[], expectedStatus: string) {
  for (const step of steps) {
    expect(step.status, `Step "${step.name}" expected ${expectedStatus} but got ${step.status}`).toBe(
      expectedStatus,
    );
  }
}

/**
 * Find a step by name and assert it exists, returning the step for further assertions.
 */
function expectStep(steps: { name: string; status: string }[], name: string) {
  const step = steps.find(s => s.name === name);
  expect(step, `Step "${name}" not found in [${steps.map(s => s.name).join(', ')}]`).toBeDefined();
  return step!;
}

test.describe('Workflow Execution', () => {
  test('workflows list page shows registered workflows', async ({ page }) => {
    await page.goto('/workflows');

    await expect(page.locator('h1')).toHaveText('Workflows');
    await expect(page.getByRole('link', { name: 'sequential-steps' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'basic-suspend' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'branch-workflow' })).toBeVisible();
    // exact: true needed — state-parallel-workflow and foreach-retry-workflow are substring matches
    await expect(page.getByRole('link', { name: 'parallel-workflow', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'foreach-workflow' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'retry-workflow', exact: true })).toBeVisible();
  });

  test('sequential-steps: run to completion', async ({ page }) => {
    await page.goto('/workflows/sequential-steps/graph');

    // Verify initial layout
    await expect(page.locator('h2')).toHaveText('sequential-steps');
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run' })).toBeVisible();

    // Fill input and run
    await page.getByRole('textbox', { name: 'Name' }).fill('Smoke Test');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for all steps to succeed by checking the last step
    const lastNode = page.locator('[data-workflow-node]').last();
    await expect(lastNode).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 10_000 });

    // Verify all steps completed with per-step diagnostics
    const steps = await getStepStatuses(page);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expectAllSteps(steps, 'success');

    // Verify expected step names are present
    const stepNames = steps.map(s => s.name);
    expect(stepNames).toContain('add-greeting');
    expect(stepNames).toContain('add-farewell');
    expect(stepNames).toContain('combine-messages');
  });

  test('sequential-steps: run via JSON input', async ({ page }) => {
    await page.goto('/workflows/sequential-steps/graph');

    // Switch to JSON mode and fill via CodeMirror
    await page.getByRole('radio', { name: 'JSON' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    // Select all: Meta+a on macOS, Control+a on Linux/Windows
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+a`);
    await page.keyboard.type('{"name":"JSON Test"}');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for the last step to succeed
    const lastNode = page.locator('[data-workflow-node]').last();
    await expect(lastNode).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 10_000 });
  });

  test('branch-workflow: positive branch for positive value', async ({ page }) => {
    await page.goto('/workflows/branch-workflow/graph');
    await expect(page.locator('h2')).toHaveText('branch-workflow');

    await page.getByRole('spinbutton', { name: 'Value' }).fill('5');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for the taken branch to succeed and the skipped branch to stay idle
    await expect(page.getByRole('button', { name: 'Handle-positive' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-workflow-step-status="idle"]').first()).toBeVisible({ timeout: 10_000 });

    const steps = await getStepStatuses(page);
    expect(expectStep(steps, 'classify-input').status).toBe('success');
    expect(expectStep(steps, 'handle-positive').status).toBe('success');
    expect(expectStep(steps, 'handle-negative').status).toBe('idle');
  });

  test('branch-workflow: negative branch for negative value', async ({ page }) => {
    await page.goto('/workflows/branch-workflow/graph');

    await page.getByRole('spinbutton', { name: 'Value' }).fill('-3');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for the taken branch to succeed and the skipped branch to stay idle
    await expect(page.getByRole('button', { name: 'Handle-negative' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-workflow-step-status="idle"]').first()).toBeVisible({ timeout: 10_000 });

    const steps = await getStepStatuses(page);
    expect(expectStep(steps, 'classify-input').status).toBe('success');
    expect(expectStep(steps, 'handle-negative').status).toBe('success');
    expect(expectStep(steps, 'handle-positive').status).toBe('idle');
  });

  test('parallel-workflow: all parallel steps succeed', async ({ page }) => {
    await page.goto('/workflows/parallel-workflow/graph');
    await expect(page.locator('h2')).toHaveText('parallel-workflow');

    await page.getByRole('spinbutton', { name: 'Value' }).fill('5');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for at least 3 nodes to render before checking statuses
    await expect(page.locator('[data-workflow-node]')).toHaveCount(3, { timeout: 10_000 });

    // Wait for all three parallel steps to succeed
    const nodes = page.locator('[data-workflow-node]');
    for (let i = 0; i < 3; i++) {
      await expect(nodes.nth(i)).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 10_000 });
    }

    // Verify all three compute steps are present (prefixed with "parallel" in the text)
    const steps = await getStepStatuses(page);
    const stepNames = steps.map(s => s.name);
    expect(stepNames, `Expected compute-square in ${JSON.stringify(stepNames)}`).toEqual(
      expect.arrayContaining([expect.stringContaining('compute-square')]),
    );
    expect(stepNames, `Expected compute-double in ${JSON.stringify(stepNames)}`).toEqual(
      expect.arrayContaining([expect.stringContaining('compute-double')]),
    );
    expect(stepNames, `Expected compute-negate in ${JSON.stringify(stepNames)}`).toEqual(
      expect.arrayContaining([expect.stringContaining('compute-negate')]),
    );
  });

  test('foreach-workflow: processes items via JSON input', async ({ page }) => {
    await page.goto('/workflows/foreach-workflow/graph');
    await expect(page.locator('h2')).toHaveText('foreach-workflow');

    // Use JSON mode — array inputs are easier via JSON
    await page.getByRole('radio', { name: 'JSON' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+a`);
    await page.keyboard.type('{"items":["hello","world"]}');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for the last step to succeed
    const lastNode = page.locator('[data-workflow-node]').last();
    await expect(lastNode).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 10_000 });

    const steps = await getStepStatuses(page);
    expectAllSteps(steps, 'success');
  });

  test('retry-workflow: succeeds after retries', async ({ page }) => {
    await page.goto('/workflows/retry-workflow/graph');
    await expect(page.locator('h2')).toHaveText('retry-workflow');

    await page.getByRole('textbox', { name: 'Message' }).fill('retry-test');
    await page.getByRole('button', { name: 'Run' }).click();

    // The flaky step fails twice then succeeds on the 3rd attempt
    const lastNode = page.locator('[data-workflow-node]').last();
    await expect(lastNode).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 15_000 });

    const steps = await getStepStatuses(page);
    expect(expectStep(steps, 'flaky-step').status).toBe('success');
  });

  test('step detail: click step to view output', async ({ page }) => {
    await page.goto('/workflows/branch-workflow/graph');

    await page.getByRole('spinbutton', { name: 'Value' }).fill('10');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for handle-positive to complete — the step button appears when it succeeds
    await expect(page.getByRole('button', { name: 'Handle-positive' })).toBeVisible({ timeout: 10_000 });

    // Click the step name button to expand its output
    await page.getByRole('button', { name: 'Handle-positive' }).click();

    // The inline output panel shows the step result
    await expect(page.getByText('Positive: 10')).toBeVisible({ timeout: 5_000 });
  });

  test('failure-workflow: step shows failed status and error detail', async ({ page }) => {
    await page.goto('/workflows/failure-workflow/graph');
    await expect(page.locator('h2')).toHaveText('failure-workflow');

    await page.getByRole('textbox', { name: 'Input' }).fill('test');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for the step to fail
    await expect(page.locator('[data-workflow-step-status="failed"]').first()).toBeVisible({ timeout: 10_000 });

    const steps = await getStepStatuses(page);
    expect(expectStep(steps, 'always-fails').status).toBe('failed');

    // Click step to see error detail in inline panel
    await page.getByRole('button', { name: 'Always-fails' }).click();
    await expect(page.getByText('Intentional failure for smoke test')).toBeVisible({ timeout: 5_000 });
  });

  test('basic-suspend: suspend and resume', async ({ page }) => {
    // This test involves suspend + resume with real async processing
    test.slow();

    await page.goto('/workflows/basic-suspend/graph');
    await expect(page.locator('h2')).toHaveText('basic-suspend');

    // Fill input and run
    await page.getByRole('textbox', { name: 'Item' }).fill('test-item');
    await page.getByRole('button', { name: 'Run' }).click();

    // Wait for suspended state: check for the suspend payload text
    await expect(page.getByText('Please approve: test-item')).toBeVisible({ timeout: 20_000 });

    // Verify step statuses: at least one succeeded, one suspended, one idle
    const stepsBeforeResume = await getStepStatuses(page);
    const suspendedStep = stepsBeforeResume.find(s => s.status === 'suspended');
    expect(suspendedStep, 'Expected a suspended step').toBeDefined();
    const idleStep = stepsBeforeResume.find(s => s.status === 'idle');
    expect(idleStep, 'Expected an idle step').toBeDefined();

    // Resume: check the approval checkbox and click resume
    await page.getByRole('checkbox', { name: 'Approved' }).check();
    await page.getByRole('button', { name: 'Resume workflow' }).click();

    // Wait for all steps to complete
    const lastNode = page.locator('[data-workflow-node]').last();
    await expect(lastNode).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 20_000 });

    // Verify all steps succeeded with per-step diagnostics
    const stepsAfterResume = await getStepStatuses(page);
    expectAllSteps(stepsAfterResume, 'success');
  });
});
