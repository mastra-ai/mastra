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

test.describe('Workflow Execution', () => {
  test('workflows list page shows registered workflows', async ({ page }) => {
    await page.goto('/workflows');

    await expect(page.locator('h1')).toHaveText('Workflows');
    await expect(page.getByRole('link', { name: 'sequential-steps' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'basic-suspend' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'branch-workflow' })).toBeVisible();
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
