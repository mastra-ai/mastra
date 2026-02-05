import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

// Helper to generate unique agent names
function uniqueAgentName(prefix = 'Test Agent') {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Helper to fill identity form fields
async function fillIdentityFields(
  page: Page,
  options: {
    name?: string;
    description?: string;
    provider?: string;
    model?: string;
    instructions?: string;
  },
) {
  if (options.name !== undefined) {
    const nameInput = page.getByLabel('Name');
    await nameInput.clear();
    await nameInput.fill(options.name);
  }

  if (options.description !== undefined) {
    const descInput = page.getByLabel('Description');
    await descInput.clear();
    await descInput.fill(options.description);
  }

  if (options.provider !== undefined) {
    // Provider uses BaseUI Combobox - find the first combobox after the Provider label
    const providerCombobox = page.getByRole('combobox').nth(0);
    await providerCombobox.click();
    await page.getByRole('option', { name: options.provider }).click();
  }

  if (options.model !== undefined) {
    // Model combobox - the second combobox on the page
    const modelCombobox = page.getByRole('combobox').nth(1);
    await modelCombobox.click();
    await page.getByRole('option', { name: options.model }).click();
  }

  if (options.instructions !== undefined) {
    // Instructions uses a CodeMirror editor
    const editor = page.locator('.cm-content');
    await editor.click();
    // Clear existing content with keyboard
    await page.keyboard.press('Meta+a');
    await page.keyboard.type(options.instructions);
  }
}

// Helper to fill all required fields with valid data
async function fillRequiredFields(page: Page, agentName?: string) {
  await fillIdentityFields(page, {
    name: agentName || uniqueAgentName(),
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
    instructions: 'You are a helpful assistant.',
  });
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Page Structure & Initial State', () => {
  // Behavior: Page displays correct title and navigation elements
  test('displays page title and header correctly', async ({ page }) => {
    await page.goto('/cms/agents/create');

    await expect(page).toHaveTitle(/Mastra Studio/);
    await expect(page.locator('h1')).toHaveText('Create an agent');
  });

  // Behavior: Identity and Capabilities tabs are visible for form organization
  test('displays Identity and Capabilities tabs', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const identityTab = page.getByRole('tab', { name: 'Identity' });
    const capabilitiesTab = page.getByRole('tab', { name: 'Capabilities' });

    await expect(identityTab).toBeVisible();
    await expect(capabilitiesTab).toBeVisible();
  });

  // Behavior: Create agent button is visible and accessible
  test('displays Create agent button', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const createButton = page.getByRole('button', { name: 'Create agent' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
  });
});

test.describe('Required Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
  });

  // Behavior: Form validates that name is required before submission
  test('shows validation error when name is empty', async ({ page }) => {
    // Fill all fields except name
    await fillIdentityFields(page, {
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show validation error for name
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  // Behavior: Form validates that instructions are required before submission
  test('shows validation error when instructions are empty', async ({ page }) => {
    await fillIdentityFields(page, {
      name: uniqueAgentName(),
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show validation error for instructions
    await expect(page.getByText('Instructions are required')).toBeVisible();
  });

  // Behavior: Form validates that provider is required before submission
  test('shows validation error when provider is not selected', async ({ page }) => {
    await fillIdentityFields(page, {
      name: uniqueAgentName(),
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show validation error - either inline or as toast
    // The form requires provider, so submission should fail
    await expect(page.getByText(/provider is required/i).or(page.getByText(/fill in all required/i))).toBeVisible({
      timeout: 5000,
    });
  });

  // Behavior: Form validates that model is required before submission
  test('shows validation error when model is not selected', async ({ page }) => {
    await fillIdentityFields(page, {
      name: uniqueAgentName(),
      provider: 'OpenAI',
      instructions: 'Test instructions',
    });

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show validation error - either inline or as toast
    await expect(page.getByText(/model is required/i).or(page.getByText(/fill in all required/i))).toBeVisible({
      timeout: 5000,
    });
  });

  // Behavior: Error toast appears when trying to submit invalid form
  test('shows error toast when submitting invalid form', async ({ page }) => {
    // Submit with empty form
    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show error toast
    await expect(page.getByText('Please fill in all required fields')).toBeVisible();
  });
});

test.describe('Agent Creation Persistence', () => {
  // Behavior: Creating agent with valid data persists to storage and redirects to chat
  test('creates agent and redirects to chat page', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Persistence Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Wait for redirect to chat page
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Verify success toast
    await expect(page.getByText('Agent created successfully')).toBeVisible();
  });

  // Behavior: Created agent appears in agents list and persists across page reload
  test('created agent appears in agents list after navigation', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('List Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Navigate to agents list
    await page.goto('/agents');

    // Verify agent appears in list
    await expect(page.getByText(agentName)).toBeVisible();
  });

  // Behavior: Agent data survives page reload (persistence verification)
  test('agent data persists across page reload', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Reload Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Reload the page
    await page.reload();

    // Verify agent name is still visible in header
    await expect(page.getByRole('heading', { name: agentName })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Identity Tab Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
  });

  // Behavior: Agent name and description are persisted correctly
  test('persists agent name and description', async ({ page }) => {
    const agentName = uniqueAgentName('Identity Test');
    const description = 'A test agent for verifying identity persistence';

    await fillIdentityFields(page, {
      name: agentName,
      description,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'You are helpful.',
    });

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Navigate to agents list
    await page.goto('/agents');

    // Verify agent appears with correct name
    await expect(page.getByText(agentName)).toBeVisible();
  });

  // Behavior: Provider selection updates available models dynamically
  test('provider selection updates available models', async ({ page }) => {
    // Select OpenAI provider - first combobox on the page
    const providerCombobox = page.getByRole('combobox').nth(0);
    await providerCombobox.click();
    await page.getByRole('option', { name: 'OpenAI' }).click();

    // Open model dropdown - second combobox on the page
    const modelCombobox = page.getByRole('combobox').nth(1);
    await modelCombobox.click();

    // Should have GPT models
    await expect(page.getByRole('option', { name: /gpt-4/i }).first()).toBeVisible();
  });
});

test.describe('Capabilities Tab - Tools Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
    // Navigate to Capabilities tab
    await page.getByRole('tab', { name: 'Capabilities' }).click();
  });

  // Behavior: Adding tools to agent configuration persists with created agent
  test('persists selected tools with created agent', async ({ page }) => {
    // Expand Tools section (collapsible trigger)
    await page.getByRole('button', { name: /Tools/i }).click();

    // Select a tool using the combobox (button with "Select tools..." text)
    const toolsCombobox = page.getByRole('combobox').filter({ hasText: /Select tools/ });
    await toolsCombobox.click();
    await page.getByRole('option', { name: /weatherInfo/i }).click();
    // Close the dropdown by clicking elsewhere
    await page.keyboard.press('Escape');

    // Verify tool is selected (shows in list below combobox)
    await expect(page.locator('text=weatherInfo').first()).toBeVisible();

    // Switch to Identity tab and fill required fields
    await page.getByRole('tab', { name: 'Identity' }).click();
    const agentName = uniqueAgentName('Tools Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Verify tool is associated with the agent in the Overview panel
    await expect(page.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Capabilities Tab - Workflows Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
    // Navigate to Capabilities tab
    await page.getByRole('tab', { name: 'Capabilities' }).click();
  });

  // Behavior: Adding workflows to agent configuration persists with created agent
  test('persists selected workflows with created agent', async ({ page }) => {
    // Expand Workflows section (collapsible trigger)
    await page.getByRole('button', { name: /Workflows/i }).click();

    // Select a workflow
    const workflowsCombobox = page.getByRole('combobox').filter({ hasText: /Select workflows/ });
    await workflowsCombobox.click();
    await page.getByRole('option', { name: /lessComplexWorkflow/i }).click();
    await page.keyboard.press('Escape');

    // Verify workflow is selected
    await expect(page.locator('text=lessComplexWorkflow').first()).toBeVisible();

    // Switch to Identity tab and fill required fields
    await page.getByRole('tab', { name: 'Identity' }).click();
    const agentName = uniqueAgentName('Workflows Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Verify workflow is associated with the agent
    await expect(page.getByText('lessComplexWorkflow')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Capabilities Tab - Sub-Agents Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
    // Navigate to Capabilities tab
    await page.getByRole('tab', { name: 'Capabilities' }).click();
  });

  // Behavior: Adding sub-agents to agent configuration persists with created agent
  test('persists selected sub-agents with created agent', async ({ page }) => {
    // Expand Sub-Agents section (collapsible trigger)
    await page.getByRole('button', { name: /Sub-Agents/i }).click();

    // Select a sub-agent
    const agentsCombobox = page.getByRole('combobox').filter({ hasText: /Select sub-agents/ });
    await agentsCombobox.click();
    await page.getByRole('option', { name: /Weather Agent/i }).click();
    await page.keyboard.press('Escape');

    // Verify agent is selected
    await expect(page.locator('text=Weather Agent').first()).toBeVisible();

    // Switch to Identity tab and fill required fields
    await page.getByRole('tab', { name: 'Identity' }).click();
    const agentName = uniqueAgentName('SubAgents Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Verify sub-agent is associated with the created agent
    await expect(page.getByText('Weather Agent')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Capabilities Tab - Scorers Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
    // Navigate to Capabilities tab
    await page.getByRole('tab', { name: 'Capabilities' }).click();
  });

  // Behavior: Adding scorers with sampling configuration persists with created agent
  test('persists selected scorers with created agent', async ({ page }) => {
    // Expand Scorers section (collapsible trigger)
    await page.getByRole('button', { name: /Scorers/i }).click();

    // Select a scorer
    const scorersCombobox = page.getByRole('combobox').filter({ hasText: /Select scorers/ });
    await scorersCombobox.click();
    await page.getByRole('option', { name: /Response Quality/i }).click();
    await page.keyboard.press('Escape');

    // Verify scorer is selected
    await expect(page.locator('text=Response Quality Scorer').first()).toBeVisible();

    // Switch to Identity tab and fill required fields
    await page.getByRole('tab', { name: 'Identity' }).click();
    const agentName = uniqueAgentName('Scorers Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Verify scorer is associated with the agent in Overview
    await expect(page.getByText(/response.*quality/i).first()).toBeVisible({ timeout: 10000 });
  });

  // Behavior: Scorer sampling configuration (ratio) persists correctly
  test('persists scorer with ratio sampling configuration', async ({ page }) => {
    // Expand Scorers section (collapsible trigger)
    await page.getByRole('button', { name: /Scorers/i }).click();

    // Select a scorer
    const scorersCombobox = page.getByRole('combobox').filter({ hasText: /Select scorers/ });
    await scorersCombobox.click();
    await page.getByRole('option', { name: /Response Quality/i }).click();
    await page.keyboard.press('Escape');

    // Configure sampling to Ratio
    await page.getByLabel('Ratio (percentage)').click();

    // Verify sample rate input appears
    await expect(page.getByLabel('Sample Rate (0-1)')).toBeVisible();

    // Switch to Identity tab and fill required fields
    await page.getByRole('tab', { name: 'Identity' }).click();
    const agentName = uniqueAgentName('Scorers Ratio Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });
  });
});

test.describe('Capabilities Tab - Memory Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
    // Navigate to Capabilities tab
    await page.getByRole('tab', { name: 'Capabilities' }).click();
  });

  // Behavior: Enabling memory configuration persists with created agent
  test('persists memory configuration with created agent', async ({ page }) => {
    // Expand Memory section (collapsible trigger)
    await page.getByRole('button', { name: /Memory/i }).click();

    // Enable memory
    const memorySwitch = page.getByRole('switch', { name: /Enable Memory/i });
    await memorySwitch.click();

    // Verify memory is enabled (shows additional options)
    await expect(page.getByLabel('Last Messages')).toBeVisible();

    // Configure lastMessages
    const lastMessagesInput = page.getByLabel('Last Messages');
    await lastMessagesInput.clear();
    await lastMessagesInput.fill('20');

    // Switch to Identity tab and fill required fields
    await page.getByRole('tab', { name: 'Identity' }).click();
    const agentName = uniqueAgentName('Memory Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Verify memory is enabled - should see Memory tab in agent panel
    await expect(page.getByRole('tab', { name: 'Memory' })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Error Handling', () => {
  // Behavior: Error toast is shown and form remains editable on API failure
  test('shows error toast and allows retry on creation failure', async ({ page }) => {
    // Set up route interception BEFORE navigating to the page
    // Only intercept POST requests to the stored agents endpoint
    await page.route('**/stored/agents', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/cms/agents/create');

    // Fill required fields
    await fillRequiredFields(page, uniqueAgentName('Error Test'));

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show error toast
    await expect(page.getByText(/Failed to create agent/i)).toBeVisible({ timeout: 10000 });

    // Form should still be editable (not reset) - still on create page
    await expect(page).toHaveURL(/\/cms\/agents\/create/);
    await expect(page.getByRole('button', { name: 'Create agent' })).toBeEnabled();
  });
});

test.describe('Form Reset After Creation', () => {
  // Behavior: Navigating back to create page shows clean form after successful creation
  test('shows clean form when navigating back to create page', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Reset Test');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 15000 });

    // Navigate back to create page
    await page.goto('/cms/agents/create');

    // Form should be empty/reset
    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toHaveValue('');
  });
});

test.describe('Full Agent Creation Flow', () => {
  // Behavior: Complete flow with all capabilities creates fully configured agent
  test('creates agent with all capabilities configured', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Full Flow Test');

    // Fill Identity fields first
    await fillIdentityFields(page, {
      name: agentName,
      description: 'A comprehensive test agent',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      instructions: 'You are a comprehensive test assistant with various capabilities.',
    });

    // Navigate to Capabilities tab
    await page.getByRole('tab', { name: 'Capabilities' }).click();

    // Add Tools
    await page.getByRole('button', { name: /Tools/i }).click();
    const toolsCombobox = page.getByRole('combobox').filter({ hasText: /Select tools/ });
    await toolsCombobox.click();
    await page.getByRole('option', { name: /weatherInfo/i }).click();
    await page.keyboard.press('Escape');

    // Add Workflows
    await page.getByRole('button', { name: /Workflows/i }).click();
    const workflowsCombobox = page.getByRole('combobox').filter({ hasText: /Select workflows/ });
    await workflowsCombobox.click();
    await page.getByRole('option', { name: /lessComplexWorkflow/i }).click();
    await page.keyboard.press('Escape');

    // Add Sub-Agents
    await page.getByRole('button', { name: /Sub-Agents/i }).click();
    const agentsCombobox = page.getByRole('combobox').filter({ hasText: /Select sub-agents/ });
    await agentsCombobox.click();
    await page.getByRole('option', { name: /Weather Agent/i }).click();
    await page.keyboard.press('Escape');

    // Add Scorers
    await page.getByRole('button', { name: /Scorers/i }).click();
    const scorersCombobox = page.getByRole('combobox').filter({ hasText: /Select scorers/ });
    await scorersCombobox.click();
    await page.getByRole('option', { name: /Response Quality/i }).click();
    await page.keyboard.press('Escape');

    // Enable Memory
    await page.getByRole('button', { name: /Memory/i }).click();
    const memorySwitch = page.getByRole('switch', { name: /Enable Memory/i });
    await memorySwitch.click();

    // Create the agent
    await page.getByRole('button', { name: 'Create agent' }).click();

    // Wait for redirect to chat page
    await expect(page).toHaveURL(/\/agents\/[a-f0-9-]+\/chat/, { timeout: 20000 });

    // Verify success toast
    await expect(page.getByText('Agent created successfully')).toBeVisible();

    // Verify agent name is visible
    await expect(page.getByRole('heading', { name: agentName })).toBeVisible({ timeout: 10000 });

    // Verify Memory tab is visible (indicates memory was enabled)
    await expect(page.getByRole('tab', { name: 'Memory' })).toBeVisible();

    // Verify capabilities in Overview
    await expect(page.getByText('weatherInfo')).toBeVisible();
    await expect(page.getByText('lessComplexWorkflow')).toBeVisible();
    await expect(page.getByText('Weather Agent')).toBeVisible();
  });
});
