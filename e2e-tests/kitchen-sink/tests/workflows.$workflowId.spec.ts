import { test, expect, Page } from '@playwright/test';

test('overall layout information', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows/complexWorkflow/graph');

  // Header
  await expect(page).toHaveTitle(/Mastra Playground/);
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

test('running the workflow (form)', async ({ page }) => {
  await page.goto('http://localhost:4111/workflows/complexWorkflow/graph');
  await checkInitialState(page);
});

async function checkInitialState(page: Page) {
  const nodes = await page.locator('[data-workflow-node]');
  await expect(nodes).toHaveCount(14);

  // Check node ordering
  await expect(nodes.nth(0)).toContainText('add-letter');
  await expect(nodes.nth(1)).toContainText('add-letter-b');
  await expect(nodes.nth(2)).toContainText('add-letter-c');
  await expect(nodes.nth(3)).toContainText('mapping');
  await expect(nodes.nth(4)).toContainText('WHEN');
  await expect(nodes.nth(5)).toContainText('short-text');
  await expect(nodes.nth(6)).toContainText('WHEN');
  await expect(nodes.nth(7)).toContainText('long-text');
  await expect(nodes.nth(8)).toContainText('mapping');
  await expect(nodes.nth(9)).toContainText('nested-text-processor');
  await expect(nodes.nth(10)).toContainText('add-letter-with-count');
  await expect(nodes.nth(11)).toContainText('DOUNTIL');
  await expect(nodes.nth(12)).toContainText('suspend-resume');
  await expect(nodes.nth(13)).toContainText('final-step');
}

async function runWorkflow(page: Page) {
  await page.getByRole('textbox', { name: 'Text' }).fill('Hello World');
  await page.getByRole('button', { name: 'Run' }).click();
}
