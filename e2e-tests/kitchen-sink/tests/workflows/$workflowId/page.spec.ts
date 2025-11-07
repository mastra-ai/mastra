import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:4111/workflows/complexWorkflow/graph');
});

test('overall layout information', async ({ page }) => {
  // Header
  await expect(page).toHaveTitle(/Mastra Studio/);
  await expect(page.locator('text=Workflows documentation')).toHaveAttribute(
    'href',
    'https://mastra.ai/en/docs/workflows/overview',
  );
  const breadcrumb = page.locator('header>nav');
  expect(breadcrumb).toMatchAriaSnapshot();

  // Thread history (with memory)
  const newChatButton = await page.locator('a:has-text("New workflow run")');
  await expect(newChatButton).toBeVisible();
  await expect(newChatButton).toHaveAttribute('href', /workflows\/complexWorkflow/);
  await expect(page.locator('text=Your run history will appear here once you run the workflow')).toBeVisible();

  // Information side panel
  await expect(page.locator('h2:has-text("complex-workflow")')).toBeVisible();
  await expect(page.locator('button:has-text("complexWorkflow")')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Form' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'JSON' })).not.toBeChecked();

  // Shows the dynamic form when FORM is selected (default)
  await expect(page.getByRole('textbox', { name: 'Text' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run' })).toBeVisible();

  // Shows the JSON input when JSON is selected
  await page.getByRole('radio', { name: 'JSON' }).click();
  const codeEditor = await page.locator('[contenteditable="true"]');
  await expect(codeEditor).toBeVisible();
  await expect(codeEditor).toHaveText('{}');
  await expect(codeEditor).toHaveAttribute('data-language', 'json');
});

test('initial workflow run state', async ({ page }) => {
  const nodes = await page.locator('[data-workflow-node]');
  await expect(nodes).toHaveCount(14);

  // Check node ordering
  await expect(nodes.nth(0)).toContainText('add-letter');
  await expect(nodes.nth(1)).toContainText('add-letter-b');
  await expect(nodes.nth(2)).toContainText('add-letter-c');
  await expect(nodes.nth(3)).toContainText('MAP'); // MAP badge now shows formatted label
  await expect(nodes.nth(4)).toContainText('WHEN');
  await expect(nodes.nth(5)).toContainText('short-text'); // condition short path
  await expect(nodes.nth(6)).toContainText('WHEN');
  await expect(nodes.nth(7)).toContainText('long-text'); // condition long path
  await expect(nodes.nth(8)).toContainText('MAP'); // MAP badge now shows formatted label
  await expect(nodes.nth(9)).toContainText('nested-text-processor');
  await expect(nodes.nth(10)).toContainText('add-letter-with-count');
  await expect(nodes.nth(11)).toContainText('DOUNTIL');
  await expect(nodes.nth(12)).toContainText('suspend-resume');
  await expect(nodes.nth(13)).toContainText('final-step');
});

test('running the workflow (form) - short condition', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Text' }).fill('A');
  await page.getByRole('button', { name: 'Run' }).click();

  await runWorkflow(page);
  await checkShortPath(page);
});

test('running the workflow (form) - long condition', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Text' }).fill('SuperLongTextToStartWith');
  await page.getByRole('button', { name: 'Run' }).click();

  await runWorkflow(page);
  await checkLongPath(page);
});

test('running the workflow (json) - short condition', async ({ page }) => {
  await page.getByRole('radio', { name: 'JSON' }).click();
  await page.getByRole('textbox').fill('{"text":"A"}');
  await page.getByRole('button', { name: 'Run' }).click();

  await runWorkflow(page);
  await checkShortPath(page);
});

test('running the workflow (json) - long condition', async ({ page }) => {
  await page.getByRole('radio', { name: 'JSON' }).click();
  await page.getByRole('textbox').fill('{"text":"SuperLongTextToStartWith"}');
  await page.getByRole('button', { name: 'Run' }).click();

  await runWorkflow(page);
  await checkLongPath(page);
});

test('resuming a workflow', async ({ page }) => {
  await page.getByRole('textbox', { name: 'Text' }).fill('A');
  await page.getByRole('button', { name: 'Run' }).click();
  await runWorkflow(page);

  await page.getByRole('textbox').fill('Hello');
  await page.getByRole('button', { name: 'Resume workflow' }).click();
  const nodes = await page.locator('[data-workflow-node]');

  await expect(nodes.nth(12)).toHaveAttribute('data-workflow-step-status', 'success', { timeout: 20000 });
  await expect(nodes.nth(13)).toHaveAttribute('data-workflow-step-status', 'success');
});

async function checkShortPath(page: Page) {
  const nodes = await page.locator('[data-workflow-node]');

  await expect(nodes.nth(5)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(nodes.nth(7)).toHaveAttribute('data-workflow-step-status', 'idle');
  await expect(page.locator('[data-testid="suspended-payload"]').locator('pre')).toHaveText(
    `1{2  \"text\": \"AABAACSABDDDDDDDDDDD\",3  \"iterationCount\": 114}`,
  );
}

async function checkLongPath(page: Page) {
  const nodes = await page.locator('[data-workflow-node]');

  await expect(nodes.nth(5)).toHaveAttribute('data-workflow-step-status', 'idle');
  await expect(nodes.nth(7)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-testid="suspended-payload"]').locator('pre')).toHaveText(
    `1{2  \"text\": \"SuperLongTextToStartWithABSuperLongTextToStartWithACLABD\",3  \"iterationCount\": 14}`,
  );
}

async function runWorkflow(page: Page) {
  const nodes = await page.locator('[data-workflow-node]');

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
