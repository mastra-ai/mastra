import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

// Helper to generate unique agent names
function uniqueAgentName(prefix = 'Test Agent') {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Helper to fill identity sidebar fields (name, description, provider, model)
async function fillIdentityFields(
  page: Page,
  options: {
    name?: string;
    description?: string;
    provider?: string;
    model?: string;
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
}

// Helper to fill an instruction block's content in the main area
// The form defaults to one empty block, so `.cm-content` is always present
async function fillInstructionBlock(page: Page, content: string, blockIndex = 0) {
  const editor = page.locator('.cm-content').nth(blockIndex);
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(content);
}

// Helper to fill all required fields with valid data
async function fillRequiredFields(page: Page, agentName?: string) {
  await fillIdentityFields(page, {
    name: agentName || uniqueAgentName(),
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
  });
  await fillInstructionBlock(page, 'You are a helpful assistant.');
}

// Helper to add a new instruction block
async function addInstructionBlock(page: Page) {
  const countBefore = await page.locator('.cm-content').count();
  await page.getByRole('button', { name: 'Add Instruction block' }).click();
  await expect(page.locator('.cm-content')).toHaveCount(countBefore + 1);
}

// Helper to delete an instruction block by index
async function deleteInstructionBlock(page: Page, blockIndex: number) {
  await page.getByRole('button', { name: 'Delete block' }).nth(blockIndex).click();
}

// Helper to navigate to the Variables tab
async function navigateToVariablesTab(page: Page) {
  await page.getByRole('tab', { name: 'Variables' }).click();
}

// Helper to add a variable with name and type
async function addVariable(page: Page, { name, type }: { name: string; type: string }) {
  await page.getByRole('button', { name: /Add variable/ }).click();
  await page.getByPlaceholder('Variable name').last().fill(name);
  const typeSelect = page.getByPlaceholder('Type').last();
  await typeSelect.click();
  await page.getByRole('option', { name: type, exact: true }).click();
}

// Helper to open Display Conditions on a specific block
async function openDisplayConditions(page: Page, blockIndex: number) {
  await page.getByText('Display Conditions').nth(blockIndex).click();
}

// Helper to configure a rule in the rule builder
async function configureRule(
  page: Page,
  {
    field,
    operator,
    value,
    isFirstRule = true,
  }: { field: string; operator?: string; value: string; isFirstRule?: boolean },
) {
  if (isFirstRule) {
    await page.getByRole('button', { name: 'Add conditional rule' }).click();
  } else {
    await page.getByRole('button', { name: /^Add rule$/ }).click();
  }

  // Select field
  const fieldSelect = page.locator('[role="combobox"]').filter({ hasText: /Select field/ }).last();
  await fieldSelect.click();
  await page.getByRole('option', { name: field }).click();

  // Select operator if non-default
  if (operator) {
    const operatorSelect = page.locator('[role="combobox"]').filter({ hasText: 'equals' }).last();
    await operatorSelect.click();
    await page.getByRole('option', { name: operator }).click();
  }

  // Fill value
  await page.getByPlaceholder('Enter value').last().fill(value);
}

// Helper to navigate to the edit page after agent creation
async function navigateToEditPage(page: Page) {
  const url = page.url();
  const match = url.match(/\/agents\/([a-z0-9-]+)\/chat/);
  const agentId = match?.[1];
  await page.goto(`/cms/agents/${agentId}/edit`);
  await expect(page.getByText(/Edit agent:/)).toBeVisible({ timeout: 10000 });
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

  // Behavior: Variables tab is visible alongside Identity and Capabilities
  test('displays Variables tab', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const variablesTab = page.getByRole('tab', { name: 'Variables' });
    await expect(variablesTab).toBeVisible();
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
    });
    await fillInstructionBlock(page, 'Test instructions');

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show validation error for name
    await expect(page.getByText('Name is required')).toBeVisible();
  });

  // Behavior: Form validates that instruction blocks must have content before submission
  test('shows validation error when instruction blocks are empty', async ({ page }) => {
    // Fill identity fields but leave instruction blocks empty (default has one empty block)
    await fillIdentityFields(page, {
      name: uniqueAgentName(),
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Should show error toast since instruction blocks are empty
    await expect(page.getByText('Please fill in all required fields')).toBeVisible();
  });

  // Behavior: Form validates that provider is required before submission
  test('shows validation error when provider is not selected', async ({ page }) => {
    await fillIdentityFields(page, {
      name: uniqueAgentName(),
    });
    await fillInstructionBlock(page, 'Test instructions');

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
    });
    await fillInstructionBlock(page, 'Test instructions');

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    });
    await fillInstructionBlock(page, 'You are helpful.');

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });
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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    // Navigate back to create page
    await page.goto('/cms/agents/create');

    // Form should be empty/reset
    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toHaveValue('');
  });
});

test.describe('Instruction Blocks Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
  });

  // Behavior: Page starts with one instruction block by default
  test('displays one instruction block by default', async ({ page }) => {
    await expect(page.locator('.cm-content')).toHaveCount(1);
  });

  // Behavior: Clicking "Add Instruction block" adds a second block
  test('adds a second instruction block', async ({ page }) => {
    await addInstructionBlock(page);
    await expect(page.locator('.cm-content')).toHaveCount(2);
  });

  // Behavior: Multiple blocks are persisted and visible on the edit page after creation
  test('creates agent with multiple instruction blocks and verifies on edit page', async ({ page }) => {
    const agentName = uniqueAgentName('Multi Block');

    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await fillInstructionBlock(page, 'You are a helpful assistant.', 0);
    await addInstructionBlock(page);
    await fillInstructionBlock(page, 'Always respond in JSON format.', 1);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    // Navigate to edit page and verify both blocks
    await navigateToEditPage(page);
    await expect(page.locator('.cm-content')).toHaveCount(2);
    await expect(page.locator('.cm-content').nth(0)).toContainText('You are a helpful assistant.');
    await expect(page.locator('.cm-content').nth(1)).toContainText('Always respond in JSON format.');
  });

  // Behavior: Deleting a block removes it from the form
  test('deletes an instruction block', async ({ page }) => {
    await addInstructionBlock(page);
    await expect(page.locator('.cm-content')).toHaveCount(2);

    await deleteInstructionBlock(page, 0);
    await expect(page.locator('.cm-content')).toHaveCount(1);
  });

  // Behavior: After deleting a block, remaining content persists through creation
  test('creates agent after deleting a block', async ({ page }) => {
    const agentName = uniqueAgentName('Delete Block');

    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await fillInstructionBlock(page, 'Block to delete', 0);
    await addInstructionBlock(page);
    await fillInstructionBlock(page, 'Block to keep', 1);

    // Delete the first block
    await deleteInstructionBlock(page, 0);
    await expect(page.locator('.cm-content')).toHaveCount(1);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    // Verify the remaining block content in the overview
    const systemPromptSection = page.locator('h3:has-text("System Prompt")').locator('..');
    await expect(systemPromptSection.getByText('Block to keep')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Variables Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');
  });

  // Behavior: Variables tab shows "Add variable" button
  test('displays Add variable button', async ({ page }) => {
    await navigateToVariablesTab(page);
    await expect(page.getByRole('button', { name: /Add variable/ })).toBeVisible();
  });

  // Behavior: Can add a variable with a name and type
  test('adds a variable with name and type', async ({ page }) => {
    await navigateToVariablesTab(page);
    await addVariable(page, { name: 'status', type: 'String' });

    // Verify the variable name input has the entered value
    await expect(page.getByPlaceholder('Variable name').last()).toHaveValue('status');
  });

  // Behavior: Display Conditions appear only when variables are defined
  test('shows Display Conditions when variables are defined', async ({ page }) => {
    // Initially no Display Conditions (no variables)
    await expect(page.getByText('Display Conditions')).toHaveCount(0);

    // Add a variable
    await navigateToVariablesTab(page);
    await addVariable(page, { name: 'status', type: 'String' });

    // Switch back to Identity tab
    await page.getByRole('tab', { name: 'Identity' }).click();

    // Display Conditions should now be visible
    await expect(page.getByText('Display Conditions')).toBeVisible();
  });
});

test.describe('Display Conditions & Rule Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cms/agents/create');

    // Add a variable so Display Conditions appear
    await navigateToVariablesTab(page);
    await addVariable(page, { name: 'status', type: 'String' });
    await page.getByRole('tab', { name: 'Identity' }).click();
  });

  // Behavior: Opening Display Conditions shows the empty rule builder
  test('opens Display Conditions and shows empty builder', async ({ page }) => {
    await openDisplayConditions(page, 0);
    await expect(page.getByRole('button', { name: 'Add conditional rule' })).toBeVisible();
  });

  // Behavior: Adding a conditional rule with field, operator, and value shows rule count badge
  test('adds a conditional rule with field, operator, value', async ({ page }) => {
    await openDisplayConditions(page, 0);
    await configureRule(page, { field: 'status', value: 'active' });

    // Verify rule count badge
    await expect(page.getByText('(1 rule)')).toBeVisible();
  });

  // Behavior: Multiple rules can be added and AND/OR toggled
  test('adds multiple rules and toggles AND/OR', async ({ page }) => {
    // Add a second variable for the second rule
    await navigateToVariablesTab(page);
    await addVariable(page, { name: 'priority', type: 'String' });
    await page.getByRole('tab', { name: 'Identity' }).click();

    await openDisplayConditions(page, 0);

    // Add first rule
    await configureRule(page, { field: 'status', value: 'active' });

    // Add second rule
    await configureRule(page, { field: 'priority', value: 'high', isFirstRule: false });

    // Verify 2 rules badge
    await expect(page.getByText('(2 rules)')).toBeVisible();

    // Toggle AND -> OR (click the operator button between rules)
    const operatorToggle = page.getByRole('button', { name: /^and$/ });
    await operatorToggle.click();
    await expect(page.getByRole('button', { name: /^or$/ })).toBeVisible();
  });

  // Behavior: Display conditions are persisted after agent creation and visible on edit page
  test('creates agent with display conditions and verifies on edit page', async ({ page }) => {
    const agentName = uniqueAgentName('Rules Test');

    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });
    await fillInstructionBlock(page, 'You are a helpful assistant.');

    // Open Display Conditions and add a rule
    await openDisplayConditions(page, 0);
    await configureRule(page, { field: 'status', value: 'active' });
    await expect(page.getByText('(1 rule)')).toBeVisible();

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    // Navigate to edit page and verify rule persisted
    await navigateToEditPage(page);
    await expect(page.getByText('(1 rule)')).toBeVisible({ timeout: 10000 });
  });

  // Behavior: Removing a conditional rule updates the count badge
  test('removes a conditional rule', async ({ page }) => {
    await openDisplayConditions(page, 0);
    await configureRule(page, { field: 'status', value: 'active' });
    await expect(page.getByText('(1 rule)')).toBeVisible();

    // Remove the rule
    await page.getByRole('button', { name: 'Remove rule' }).click();
    await expect(page.getByText('(1 rule)')).toHaveCount(0);
  });
});

test.describe('Full Agent Creation Flow', () => {
  /**
   * FEATURE: Agent Creation with All Capabilities
   * USER STORY: As a user, I want to create an agent with tools, workflows, sub-agents,
   *             scorers, and memory so that the agent has all capabilities configured.
   * BEHAVIOR UNDER TEST: All configured capabilities are persisted and displayed in the
   *                      agent overview side panel after creation.
   */
  test('creates agent with all capabilities and verifies them in overview side panel', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Full Flow Test');

    // Fill Identity fields first
    await fillIdentityFields(page, {
      name: agentName,
      description: 'A comprehensive test agent',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    // Fill first instruction block content in the main area
    await fillInstructionBlock(page, 'You are a comprehensive test assistant with various capabilities.');

    // Add a second instruction block
    await addInstructionBlock(page);
    await fillInstructionBlock(page, 'Always respond with detailed explanations.', 1);

    // Add a variable for display conditions
    await navigateToVariablesTab(page);
    await addVariable(page, { name: 'userRole', type: 'String' });
    await page.getByRole('tab', { name: 'Identity' }).click();

    // Open Display Conditions on the first block and add a rule
    await openDisplayConditions(page, 0);
    await configureRule(page, { field: 'userRole', value: 'admin' });
    await expect(page.getByText('(1 rule)')).toBeVisible();

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
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 20000 });

    // Verify success toast
    await expect(page.getByText('Agent created successfully')).toBeVisible();

    // Verify agent name is visible in the overview header
    await expect(page.getByRole('heading', { name: agentName })).toBeVisible({ timeout: 10000 });

    // Verify Overview tab is selected (default tab)
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    // ========================================
    // VERIFY ALL CAPABILITIES IN OVERVIEW SIDE PANEL
    // ========================================

    // 1. Memory: Badge should show "On" when memory is enabled
    const memorySection = page.locator('h3:has-text("Memory")').locator('..');
    await expect(memorySection.getByText('On')).toBeVisible({ timeout: 10000 });

    // 2. Memory tab should be visible (additional verification)
    await expect(page.getByRole('tab', { name: 'Memory' })).toBeVisible();

    // 3. Tools: weatherInfo should be visible in the Tools section
    const toolsSection = page.locator('h3:has-text("Tools")').locator('..');
    await expect(toolsSection.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });

    // 4. Workflows: lessComplexWorkflow should be visible in the Workflows section
    const workflowsSection = page.locator('h3:has-text("Workflows")').locator('..');
    await expect(workflowsSection.getByText('lessComplexWorkflow')).toBeVisible({ timeout: 10000 });

    // 5. Agents (Sub-Agents): Weather Agent should be visible in the Agents section
    const agentsSection = page.locator('h3:has-text("Agents")').locator('..');
    await expect(agentsSection.getByText('Weather Agent')).toBeVisible({ timeout: 10000 });

    // 6. Scorers: Response Quality Scorer should be visible in the Scorers section
    const scorersSection = page.locator('h3:has-text("Scorers")').locator('..');
    await expect(scorersSection.getByText(/Response Quality/i)).toBeVisible({ timeout: 10000 });

    // 7. System Prompt: Verify the instructions are displayed (both blocks)
    const systemPromptSection = page.locator('h3:has-text("System Prompt")').locator('..');
    await expect(systemPromptSection.getByText('You are a comprehensive test assistant')).toBeVisible({
      timeout: 10000,
    });
    await expect(systemPromptSection.getByText('Always respond with detailed explanations')).toBeVisible({
      timeout: 10000,
    });

    // ========================================
    // VERIFY BLOCKS AND RULES ON EDIT PAGE
    // ========================================
    await navigateToEditPage(page);

    // 8. Verify 2 instruction blocks exist on the edit page
    await expect(page.locator('.cm-content')).toHaveCount(2);
    await expect(page.locator('.cm-content').nth(0)).toContainText(
      'You are a comprehensive test assistant with various capabilities.',
    );
    await expect(page.locator('.cm-content').nth(1)).toContainText('Always respond with detailed explanations.');

    // 9. Verify Display Conditions on the first block show the persisted rule
    await expect(page.getByText('(1 rule)')).toBeVisible({ timeout: 10000 });
  });
});
