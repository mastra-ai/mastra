import { test, expect } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

/**
 * FEATURE: Agent Creation Page
 * USER STORY: As a user, I want to create a new agent with instructions and configurations
 *             so that I can use it to interact with my data
 * BEHAVIOR UNDER TEST: Agent creation persists and is usable after creation
 */

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Agent Creation - Behavior Tests', () => {
  test('should display the agent creation page with required elements', async ({ page }) => {
    // ARRANGE & ACT: Navigate to the agent creation page
    await page.goto('/cms/agents/create');

    // ASSERT: Verify the page has the expected structure
    await expect(page.locator('h1')).toContainText('Create Agent');

    // Verify form elements exist
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="description"]')).toBeVisible();

    // Verify Publish button exists
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible();
  });

  test('should show validation errors when submitting empty form', async ({ page }) => {
    // ARRANGE: Navigate to the agent creation page
    await page.goto('/cms/agents/create');

    // ACT: Try to submit without filling required fields
    await page.getByRole('button', { name: 'Publish' }).click();

    // ASSERT: Verify validation feedback appears
    // Note: The actual error display depends on the toast implementation
    await expect(page.getByText(/required/i)).toBeVisible({ timeout: 5000 });
  });

  test('should create agent with name and instructions and redirect to chat', async ({ page }) => {
    // ARRANGE: Navigate to the agent creation page
    await page.goto('/cms/agents/create');
    const agentName = `Test Agent ${Date.now()}`;
    const agentInstructions = 'You are a helpful assistant that answers questions about weather.';

    // ACT: Fill in the required fields
    await page.locator('input[name="name"]').fill(agentName);
    await page.locator('input[name="description"]').fill('A test agent for e2e testing');

    // Fill instructions in the CodeMirror editor
    const codeEditor = page.locator('.cm-editor');
    await codeEditor.click();
    await page.keyboard.type(agentInstructions);

    // Submit the form
    await page.getByRole('button', { name: 'Publish' }).click();

    // ASSERT: Verify redirect to the agent chat page
    await expect(page).toHaveURL(/\/agents\/.*\/chat/, { timeout: 10000 });
  });

  test('should show sidebar with entity pickers for configuration', async ({ page }) => {
    // ARRANGE & ACT: Navigate to the agent creation page
    await page.goto('/cms/agents/create');

    // ASSERT: Verify sidebar sections exist
    await expect(page.getByRole('heading', { name: 'Model' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sub-Agents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scorers' })).toBeVisible();
  });

  test('should persist agent data after creation and reload', async ({ page }) => {
    // ARRANGE: Navigate to the agent creation page
    await page.goto('/cms/agents/create');
    const agentName = `Persist Test ${Date.now()}`;

    // ACT: Create an agent
    await page.locator('input[name="name"]').fill(agentName);

    const codeEditor = page.locator('.cm-editor');
    await codeEditor.click();
    await page.keyboard.type('Test instructions for persistence check');

    await page.getByRole('button', { name: 'Publish' }).click();

    // Wait for navigation to complete
    await expect(page).toHaveURL(/\/agents\/.*\/chat/, { timeout: 10000 });

    // Extract the agent ID from URL
    const url = page.url();
    const agentIdMatch = url.match(/\/agents\/([^/]+)\/chat/);
    const agentId = agentIdMatch?.[1];
    expect(agentId).toBeTruthy();

    // ASSERT: Navigate to agents list and verify agent exists
    await page.goto('/agents');
    await expect(page.getByText(agentName)).toBeVisible({ timeout: 10000 });
  });
});
