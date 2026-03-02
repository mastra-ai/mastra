import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

// Helper to generate unique agent names
function uniqueAgentName(prefix = 'Test Agent') {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Sidebar link paths for each page
const SIDEBAR_PATHS: Record<string, string> = {
  Identity: '',
  Instructions: '/instruction-blocks',
  Tools: '/tools',
  Agents: '/agents',
  Scorers: '/scorers',
  Workflows: '/workflows',
  Preprocessors: '/processors',
  Memory: '/memory',
  Variables: '/variables',
};

// Navigate to a create sub-page via sidebar link (client-side, preserves form state).
// Uses exact href matching to avoid ambiguity with top nav links.
async function clickSidebarLink(page: Page, linkName: string) {
  const pathSuffix = SIDEBAR_PATHS[linkName];
  if (pathSuffix === undefined) throw new Error(`Unknown sidebar link: ${linkName}`);
  const href = `/cms/agents/create${pathSuffix}`;
  const link = page.locator(`a[href="${href}"]`);
  await link.click();
  await page.waitForTimeout(500);
}

// Fill the identity fields on the create page (assumes page is at /cms/agents/create)
async function fillIdentityFields(
  page: Page,
  options: { name: string; description?: string; provider?: string; model?: string },
) {
  const nameInput = page.locator('#agent-name');
  await nameInput.clear();
  await nameInput.fill(options.name);

  if (options.description) {
    const descInput = page.locator('#agent-description');
    await descInput.clear();
    await descInput.fill(options.description);
  }

  // On create page: nth(0) = provider, nth(1) = model
  const providerCombobox = page.getByRole('combobox').nth(0);
  await providerCombobox.click();
  await page.getByRole('option', { name: options.provider ?? 'OpenAI' }).click();

  const modelCombobox = page.getByRole('combobox').nth(1);
  await modelCombobox.click();
  await page.getByRole('option', { name: options.model ?? 'gpt-4o-mini' }).click();
}

// Fill required fields (identity + minimal instruction block) using sidebar navigation
async function fillRequiredFields(page: Page, agentName?: string) {
  const name = agentName || uniqueAgentName();

  await fillIdentityFields(page, { name });

  // Navigate to instruction blocks via sidebar and add content
  await clickSidebarLink(page, 'Instructions');
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.type('You are a helpful test agent.');
}

// Create agent and extract ID from redirect URL
async function createAgentAndGetId(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Create agent' }).click();

  // Wait for redirect to agent chat page — this confirms creation succeeded
  await expect(page).toHaveURL(/\/agents\/[a-zA-Z0-9-]+\/chat/, { timeout: 30000 });

  const url = page.url();
  const agentId = url.split('/agents/')[1]?.split('/')[0];
  if (!agentId) throw new Error('Could not extract agent ID from URL: ' + url);
  return agentId;
}

// Navigate directly to an edit sub-page (full page load, for verification).
// On edit page, combobox nth(0) = version, nth(1) = provider, nth(2) = model.
async function goToEditSubPage(page: Page, agentId: string, subPage = '') {
  await page.goto(`/cms/agents/${agentId}/edit${subPage}`);
  await page.locator('#agent-name').waitFor({ state: 'visible', timeout: 15000 });
}

// Navigate to an edit sub-page via sidebar link (client-side navigation).
// This first loads the edit identity page and waits for data, then clicks the sidebar link.
// Needed for pages like Variables whose JSONSchemaForm.Root only reads defaultValue on mount.
async function goToEditSubPageViaSidebar(page: Page, agentId: string, linkName: string) {
  await goToEditSubPage(page, agentId);
  // Wait for agent name to be populated (data loaded and form.reset happened)
  await expect(page.locator('#agent-name')).not.toHaveValue('', { timeout: 15000 });
  // Click sidebar link for client-side navigation
  const pathSuffix = SIDEBAR_PATHS[linkName];
  if (pathSuffix === undefined) throw new Error(`Unknown sidebar link: ${linkName}`);
  const href = `/cms/agents/${agentId}/edit${pathSuffix}`;
  const link = page.locator(`a[href="${href}"]`);
  await link.click();
  await page.waitForTimeout(1000);
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Page Structure & Initial State', () => {
  test('displays page title and header correctly', async ({ page }) => {
    await page.goto('/cms/agents/create');

    await expect(page).toHaveTitle(/Mastra Studio/);
    await expect(page.locator('h1')).toHaveText('Create an agent');
  });

  test('displays Create agent button disabled until required fields are filled', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const createButton = page.getByRole('button', { name: 'Create agent' });
    await expect(createButton).toBeVisible();
    // Button should be disabled when form is empty
    await expect(createButton).toBeDisabled();
  });

  test('displays sidebar navigation with all pages', async ({ page }) => {
    await page.goto('/cms/agents/create');

    // Verify each sidebar link exists by exact href
    for (const [, suffix] of Object.entries(SIDEBAR_PATHS)) {
      const href = `/cms/agents/create${suffix}`;
      await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });
});

test.describe('Create Button Enable/Disable Behavior', () => {
  test('button stays disabled when only partial identity fields are filled', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const createButton = page.getByRole('button', { name: 'Create agent' });

    // Fill only name — missing provider, model, and instructions
    const nameInput = page.locator('#agent-name');
    await nameInput.fill('Test Agent');

    await expect(createButton).toBeDisabled();

    // Fill provider but not model
    const providerCombobox = page.getByRole('combobox').nth(0);
    await providerCombobox.click();
    await page.getByRole('option', { name: 'OpenAI' }).click();

    await expect(createButton).toBeDisabled();
  });

  test('button stays disabled when identity is complete but instructions are empty', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const createButton = page.getByRole('button', { name: 'Create agent' });

    // Fill all identity fields
    await fillIdentityFields(page, { name: 'Test Agent' });

    // Button should still be disabled because instructions are empty
    await expect(createButton).toBeDisabled();
  });

  test('button becomes enabled when all required fields are filled', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const createButton = page.getByRole('button', { name: 'Create agent' });

    // Initially disabled
    await expect(createButton).toBeDisabled();

    // Fill all required fields
    await fillRequiredFields(page);

    // Now enabled
    await expect(createButton).toBeEnabled();
  });

  test('button becomes disabled again when required field is cleared', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const createButton = page.getByRole('button', { name: 'Create agent' });

    // Fill all required fields
    await fillRequiredFields(page);
    await expect(createButton).toBeEnabled();

    // Go back to identity and clear the name
    await clickSidebarLink(page, 'Identity');
    const nameInput = page.locator('#agent-name');
    await nameInput.clear();

    // Button should be disabled again
    await expect(createButton).toBeDisabled();
  });
});

test.describe('Agent Creation Persistence - Identity', () => {
  test('creates agent with minimal required fields and verifies on edit page', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Minimal');
    await fillRequiredFields(page, agentName);

    const agentId = await createAgentAndGetId(page);

    // On edit page: nth(0) = provider, nth(1) = model
    await goToEditSubPage(page, agentId);

    await expect(page.locator('#agent-name')).toHaveValue(agentName);
    await expect(page.getByRole('combobox').nth(0)).toContainText('OpenAI');
    await expect(page.getByRole('combobox').nth(1)).toContainText('gpt-4o-mini');
  });

  test('persists all identity fields (name, description, provider, model)', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Full Identity');
    const description = 'A comprehensive test agent for E2E testing';

    await fillIdentityFields(page, { name: agentName, description });

    // Add instruction block via sidebar
    await clickSidebarLink(page, 'Instructions');
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.type('You are a test agent.');

    const agentId = await createAgentAndGetId(page);

    await goToEditSubPage(page, agentId);

    await expect(page.locator('#agent-name')).toHaveValue(agentName);
    await expect(page.locator('#agent-description')).toHaveValue(description);
    await expect(page.getByRole('combobox').nth(0)).toContainText('OpenAI');
    await expect(page.getByRole('combobox').nth(1)).toContainText('gpt-4o-mini');
  });
});

test.describe('Agent Creation Persistence - Instruction Blocks', () => {
  test('persists single instruction block with content', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Single Block');
    const instructionContent = 'You are a helpful assistant that answers questions accurately.';

    await fillIdentityFields(page, { name: agentName });

    // Navigate to instruction blocks via sidebar
    await clickSidebarLink(page, 'Instructions');
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.type(instructionContent);

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/instruction-blocks`);
    await page.waitForTimeout(2000);

    await expect(page.locator('.cm-content').first()).toContainText(instructionContent, { timeout: 10000 });
  });

  test('persists multiple instruction blocks in order', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Multi Block');
    const block1Content = 'You are a helpful assistant.';
    const block2Content = 'Always be polite and concise.';

    await fillIdentityFields(page, { name: agentName });

    // Navigate to instruction blocks via sidebar
    await clickSidebarLink(page, 'Instructions');

    // Fill first block
    const editor1 = page.locator('.cm-content').first();
    await editor1.click();
    await page.keyboard.type(block1Content);

    // Add second block (click dropdown trigger, then select inline option)
    await page.getByRole('button', { name: 'Add Instruction block' }).click();
    await page.getByRole('menuitem', { name: 'Write inline block' }).click();
    await page.waitForTimeout(500);

    // Fill second block
    const editor2 = page.locator('.cm-content').nth(1);
    await editor2.click();
    await page.keyboard.type(block2Content);

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/instruction-blocks`);
    await page.waitForTimeout(2000);

    await expect(page.locator('.cm-content').first()).toContainText(block1Content, { timeout: 10000 });
    await expect(page.locator('.cm-content').nth(1)).toContainText(block2Content, { timeout: 10000 });
  });
});

test.describe('Agent Creation Persistence - Tools', () => {
  test('persists selected tools', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Tools');
    await fillRequiredFields(page, agentName);

    // Navigate to tools page via sidebar
    await clickSidebarLink(page, 'Tools');

    // Wait for tools to load
    await expect(page.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });

    // Toggle the first tool switch
    const firstSwitch = page.getByRole('switch').first();
    await firstSwitch.click();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/tools`);
    await page.waitForTimeout(2000);

    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });
  });
});

test.describe('Agent Creation Persistence - MCP Client Tools', () => {
  /**
   * FEATURE: MCP Client Tool Selection
   * USER STORY: As a user, I want to select which MCP tools my agent can use
   *             so that I can control the agent's capabilities
   * BEHAVIOR UNDER TEST: Selected MCP tools persist after agent creation and reload
   */
  test('persists selected MCP client tools', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('MCP Tools');
    await fillRequiredFields(page, agentName);

    // Navigate to tools page via sidebar
    await clickSidebarLink(page, 'Tools');

    // Click "Add MCP Client" button
    await page.getByRole('button', { name: 'Add MCP Client' }).first().click();

    // Wait for the side dialog to open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Fill MCP client name
    await page.locator('#mcp-client-name').fill('Test MCP Client');

    // The kitchen-sink exposes the simple-mcp-server at /api/mcp/simple-mcp-server/mcp
    // Fill URL field (HTTP is default)
    await page.locator('#mcp-url').fill('http://localhost:4111/api/mcp/simple-mcp-server/mcp');

    // Click "Try to connect" button
    await page.getByRole('button', { name: /try to connect/i }).click();

    // Wait for tools to appear in the preview panel
    await expect(page.getByRole('dialog').getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });

    // The tool should have a switch - verify it's initially unchecked (default: unselected)
    const toolSwitch = page.getByRole('dialog').getByRole('switch').first();
    await expect(toolSwitch).not.toBeChecked();

    // Toggle the tool ON
    await toolSwitch.click();
    await expect(toolSwitch).toBeChecked();

    // Header should show "1/1 selected"
    await expect(page.getByText(/1\/1 selected/)).toBeVisible();

    // Click "Create MCP Client" button to confirm
    await page.getByRole('button', { name: /create mcp client/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // The MCP client should now appear in the list
    await expect(page.getByText('Test MCP Client')).toBeVisible();

    // Create the agent
    const agentId = await createAgentAndGetId(page);

    // Verify on edit page - navigate to tools
    await page.goto(`/cms/agents/${agentId}/edit/tools`);
    await page.waitForTimeout(2000);

    // The MCP client should be visible
    await expect(page.getByText('Test MCP Client')).toBeVisible({ timeout: 10000 });

    // Click on the MCP client to view it
    await page.getByText('Test MCP Client').click();

    // Wait for dialog to open and connect
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // Wait for tools to load (auto-connects in view mode)
    await expect(page.getByRole('dialog').getByText('simpleMcpTool')).toBeVisible({ timeout: 10000 });

    // The tool switch should still be checked (persisted selection)
    const persistedSwitch = page.getByRole('dialog').getByRole('switch').first();
    await expect(persistedSwitch).toBeChecked({ timeout: 5000 });
  });
});

test.describe('Agent Creation Persistence - Sub-Agents', () => {
  test('persists selected sub-agents', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('SubAgents');
    await fillRequiredFields(page, agentName);

    // Navigate to agents page via sidebar
    await clickSidebarLink(page, 'Agents');

    // Wait for agents list to load
    await page.waitForTimeout(1000);

    // Toggle first available agent
    const agentSwitch = page.getByRole('switch').first();
    await expect(agentSwitch).toBeVisible({ timeout: 10000 });
    await agentSwitch.click();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/agents`);
    await page.waitForTimeout(2000);

    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });
  });
});

test.describe('Agent Creation Persistence - Scorers', () => {
  test('persists selected scorers with sampling configuration', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Scorers');
    await fillRequiredFields(page, agentName);

    // Navigate to scorers page via sidebar
    await clickSidebarLink(page, 'Scorers');

    // Wait for scorers to load
    await page.waitForTimeout(1000);

    // Toggle first scorer
    const scorerSwitch = page.getByRole('switch').first();
    await expect(scorerSwitch).toBeVisible({ timeout: 10000 });
    await scorerSwitch.click();

    // Configure sampling to ratio
    const ratioLabel = page.getByText('Ratio (percentage)').first();
    await expect(ratioLabel).toBeVisible({ timeout: 5000 });
    await ratioLabel.click();

    // Set sample rate
    const rateInput = page.locator('input[type="number"]').first();
    await rateInput.clear();
    await rateInput.fill('0.5');

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/scorers`);
    await page.waitForTimeout(2000);

    // Scorer switch should be checked
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });

    // Ratio radio should be selected
    await expect(page.getByRole('radio', { name: /ratio/i }).first()).toBeChecked();

    // Sample rate should be 0.5
    await expect(page.locator('input[type="number"]').first()).toHaveValue('0.5');
  });
});

test.describe('Agent Creation Persistence - Workflows', () => {
  test('persists selected workflows', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Workflows');
    await fillRequiredFields(page, agentName);

    // Navigate to workflows page via sidebar
    await clickSidebarLink(page, 'Workflows');

    // Wait for workflows to load
    await page.waitForTimeout(1000);

    // Toggle first workflow
    const workflowSwitch = page.getByRole('switch').first();
    await expect(workflowSwitch).toBeVisible({ timeout: 10000 });
    await workflowSwitch.click();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/workflows`);
    await page.waitForTimeout(2000);

    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });
  });
});

test.describe('Agent Creation Persistence - Memory', () => {
  test('persists memory enabled with lastMessages', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Memory');
    await fillRequiredFields(page, agentName);

    // Navigate to memory page via sidebar
    await clickSidebarLink(page, 'Memory');

    // Memory is disabled by default — click "Enable Memory" button (not a switch)
    await page.getByRole('button', { name: 'Enable Memory' }).click();

    // Wait for memory fields to appear
    await expect(page.locator('#memory-last-messages')).toBeVisible({ timeout: 5000 });

    // Set lastMessages
    const lastMessagesInput = page.locator('#memory-last-messages');
    await lastMessagesInput.fill('20');

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/memory`);
    await page.waitForTimeout(2000);

    // Memory should be enabled
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });

    // lastMessages should have value 20
    await expect(page.locator('#memory-last-messages')).toHaveValue('20');
  });

  test('persists memory with readOnly enabled', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('ReadOnly Memory');
    await fillRequiredFields(page, agentName);

    // Navigate to memory page via sidebar
    await clickSidebarLink(page, 'Memory');

    // Memory is disabled by default — click "Enable Memory" button (not a switch)
    await page.getByRole('button', { name: 'Enable Memory' }).click();
    await expect(page.locator('#memory-last-messages')).toBeVisible({ timeout: 5000 });

    // The switches after memory enabled are: main=0, OM=1, LastMessages=2, SemanticRecall=3, ReadOnly=4
    const readOnlySwitch = page.getByRole('switch').nth(4);
    await readOnlySwitch.click();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/memory`);
    await page.waitForTimeout(2000);

    // Memory enabled
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });

    // Read Only should be checked (5th switch, index 4)
    await expect(page.getByRole('switch').nth(4)).toBeChecked();
  });

  test('persists observational memory settings', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('OM Memory');
    await fillRequiredFields(page, agentName);

    // Navigate to memory page via sidebar
    await clickSidebarLink(page, 'Memory');

    // Memory is disabled by default — click "Enable Memory" button (not a switch)
    await page.getByRole('button', { name: 'Enable Memory' }).click();
    await expect(page.locator('#memory-last-messages')).toBeVisible({ timeout: 5000 });

    // Enable Observational Memory (2nd switch: main=0, OM=1, LastMessages=2, SemanticRecall=3, ReadOnly=4)
    const omSwitch = page.getByRole('switch').nth(1);
    await omSwitch.click();

    // Wait for OM fields to appear
    await expect(page.locator('#memory-om-scope')).toBeVisible({ timeout: 5000 });

    // Set scope to resource
    const scopeSelect = page.locator('#memory-om-scope');
    await scopeSelect.click();
    await page.getByRole('option', { name: 'Resource' }).click();

    // Enable share token budget
    const shareBudgetSwitch = page.locator('#memory-om-share-budget');
    await shareBudgetSwitch.click();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/memory`);
    await page.waitForTimeout(2000);

    // Memory should be enabled
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });

    // OM should be enabled (2nd switch, index 1)
    await expect(page.getByRole('switch').nth(1)).toBeChecked();

    // Scope should be resource
    await expect(page.locator('#memory-om-scope')).toContainText('Resource');

    // Share budget should be on
    await expect(page.locator('#memory-om-share-budget')).toBeChecked();
  });
});

test.describe('Agent Creation Persistence - Variables', () => {
  test('persists single variable definition', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Variables');
    await fillRequiredFields(page, agentName);

    // Navigate to variables page via sidebar
    await clickSidebarLink(page, 'Variables');

    // Add a variable
    await page.getByRole('button', { name: 'Add variable' }).click();
    await page.waitForTimeout(500);

    const nameInput = page.getByPlaceholder('Variable name').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('userName');

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page - navigate via sidebar so VariablesPage mounts after data is loaded
    await goToEditSubPageViaSidebar(page, agentId, 'Variables');

    await expect(page.getByPlaceholder('Variable name').first()).toHaveValue('userName', { timeout: 10000 });
  });

  test('persists multiple variables', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Multi Vars');
    await fillRequiredFields(page, agentName);

    // Navigate to variables page via sidebar
    await clickSidebarLink(page, 'Variables');

    // Add first variable
    await page.getByRole('button', { name: 'Add variable' }).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Variable name').first().fill('firstName');

    // Add second variable
    await page.getByRole('button', { name: 'Add variable' }).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Variable name').nth(1).fill('age');

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page - navigate via sidebar so VariablesPage mounts after data is loaded
    await goToEditSubPageViaSidebar(page, agentId, 'Variables');

    await expect(page.getByPlaceholder('Variable name').first()).toHaveValue('firstName', { timeout: 10000 });
    await expect(page.getByPlaceholder('Variable name').nth(1)).toHaveValue('age');
  });
});

test.describe('Agent Creation Persistence - Preprocessors', () => {
  // Helper: find a provider's toggle switch by locating the provider name, then traversing
  // up to the header row (EntityName -> EntityContent -> flex div) and finding the switch.
  function getProviderToggle(page: Page, providerName: string) {
    return page.getByText(providerName, { exact: true }).locator('..').locator('..').getByRole('switch');
  }

  test('displays available processor providers', async ({ page }) => {
    await page.goto('/cms/agents/create');

    await clickSidebarLink(page, 'Preprocessors');

    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Content Filter Processor', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('toggling processor on enables phase switches', async ({ page }) => {
    await page.goto('/cms/agents/create');

    await clickSidebarLink(page, 'Preprocessors');
    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });

    // Toggle logging processor on
    const loggingToggle = getProviderToggle(page, 'Logging Processor');
    await loggingToggle.click();
    await expect(loggingToggle).toBeChecked();

    // Phase label "Process Input" should appear with its switch checked by default
    await expect(page.getByText('Process Input')).toBeVisible({ timeout: 5000 });
    const processInputSwitch = page.getByText('Process Input').locator('..').getByRole('switch');
    await expect(processInputSwitch).toBeChecked();
  });

  test('processor selection persists after agent creation', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Processor');
    await fillRequiredFields(page, agentName);

    // Enable logging processor
    await clickSidebarLink(page, 'Preprocessors');
    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });
    const loggingToggle = getProviderToggle(page, 'Logging Processor');
    await loggingToggle.click();
    await expect(loggingToggle).toBeChecked();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    // Logging processor toggle should be checked
    const editLoggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(editLoggingToggle).toBeChecked({ timeout: 10000 });

    // Content filter should remain unchecked
    const editContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(editContentToggle).not.toBeChecked();
  });

  test('phase toggle changes persist after agent creation', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Phase Toggle');
    await fillRequiredFields(page, agentName);

    // Enable content filter processor
    await clickSidebarLink(page, 'Preprocessors');
    await expect(page.getByText('Content Filter Processor', { exact: true })).toBeVisible({ timeout: 10000 });
    const contentToggle = getProviderToggle(page, 'Content Filter Processor');
    await contentToggle.click();
    await expect(contentToggle).toBeChecked();

    // Both phases should be enabled by default
    await expect(page.getByText('Process Output Result')).toBeVisible({ timeout: 5000 });

    // Toggle off Process Output Result phase
    const processOutputSwitch = page.getByText('Process Output Result').locator('..').getByRole('switch');
    await processOutputSwitch.click();
    await expect(processOutputSwitch).not.toBeChecked();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    // Content filter should be enabled
    const editContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(editContentToggle).toBeChecked({ timeout: 10000 });

    // Process Output Result should be unchecked (we toggled it off)
    const editProcessOutputSwitch = page.getByText('Process Output Result').locator('..').getByRole('switch');
    await expect(editProcessOutputSwitch).not.toBeChecked();
  });

  test('multiple processors can be enabled simultaneously', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Multi Processor');
    await fillRequiredFields(page, agentName);

    await clickSidebarLink(page, 'Preprocessors');
    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });

    // Enable both processors by name
    const loggingToggle = getProviderToggle(page, 'Logging Processor');
    await loggingToggle.click();
    await expect(loggingToggle).toBeChecked();

    const contentToggle = getProviderToggle(page, 'Content Filter Processor');
    await contentToggle.click();
    await expect(contentToggle).toBeChecked();

    const agentId = await createAgentAndGetId(page);

    // Verify on edit page
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    // Both providers should be enabled
    const editLoggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(editLoggingToggle).toBeChecked({ timeout: 10000 });
    const editContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(editContentToggle).toBeChecked({ timeout: 10000 });

    // Content filter's unique phase "Process Output Result" should be checked
    const editProcessOutputSwitch = page.getByText('Process Output Result').locator('..').getByRole('switch');
    await expect(editProcessOutputSwitch).toBeChecked();
  });
});

test.describe('Comprehensive Persistence Test', () => {
  test('persists all fields across all pages', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Comprehensive');
    const description = 'A comprehensive agent with all fields configured';

    // === Identity Page ===
    await fillIdentityFields(page, { name: agentName, description });

    // === Instruction Blocks ===
    await clickSidebarLink(page, 'Instructions');
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await page.keyboard.type('You are a comprehensive test agent.');

    // === Tools ===
    await clickSidebarLink(page, 'Tools');
    await page.waitForTimeout(1000);
    const toolSwitches = page.getByRole('switch');
    if ((await toolSwitches.count()) > 0) {
      await toolSwitches.first().click();
    }

    // === Workflows ===
    await clickSidebarLink(page, 'Workflows');
    await page.waitForTimeout(1000);
    const wfSwitches = page.getByRole('switch');
    if ((await wfSwitches.count()) > 0) {
      await wfSwitches.first().click();
    }

    // === Memory ===
    await clickSidebarLink(page, 'Memory');
    // Memory is disabled by default — click "Enable Memory" button (not a switch)
    await page.getByRole('button', { name: 'Enable Memory' }).click();
    await expect(page.locator('#memory-last-messages')).toBeVisible({ timeout: 5000 });
    const lastMsgInput = page.locator('#memory-last-messages');
    await lastMsgInput.fill('25');

    // === Variables ===
    await clickSidebarLink(page, 'Variables');
    await page.getByRole('button', { name: 'Add variable' }).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder('Variable name').first().fill('context');

    // === Create ===
    const agentId = await createAgentAndGetId(page);

    // === Verify Identity ===
    await goToEditSubPage(page, agentId);
    await expect(page.locator('#agent-name')).toHaveValue(agentName);
    await expect(page.locator('#agent-description')).toHaveValue(description);
    // On edit page: nth(0) = provider, nth(1) = model
    await expect(page.getByRole('combobox').nth(0)).toContainText('OpenAI');
    await expect(page.getByRole('combobox').nth(1)).toContainText('gpt-4o-mini');

    // === Verify Instructions ===
    await page.goto(`/cms/agents/${agentId}/edit/instruction-blocks`);
    await page.waitForTimeout(2000);
    await expect(page.locator('.cm-content').first()).toContainText('You are a comprehensive test agent.', {
      timeout: 10000,
    });

    // === Verify Tools ===
    await page.goto(`/cms/agents/${agentId}/edit/tools`);
    await page.waitForTimeout(2000);
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });

    // === Verify Workflows ===
    await page.goto(`/cms/agents/${agentId}/edit/workflows`);
    await page.waitForTimeout(2000);
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });

    // === Verify Memory ===
    await page.goto(`/cms/agents/${agentId}/edit/memory`);
    await page.waitForTimeout(2000);
    await expect(page.getByRole('switch').first()).toBeChecked({ timeout: 10000 });
    await expect(page.locator('#memory-last-messages')).toHaveValue('25');

    // === Verify Variables (via sidebar so VariablesPage mounts after data is loaded) ===
    await goToEditSubPageViaSidebar(page, agentId, 'Variables');
    await expect(page.getByPlaceholder('Variable name').first()).toHaveValue('context', { timeout: 10000 });
  });
});

test.describe('Error Handling', () => {
  test('shows error toast and allows retry on creation failure', async ({ page }) => {
    // Intercept stored agent creation requests
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.includes('/api/stored/agents') && route.request().method() === 'POST') {
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

    await fillRequiredFields(page, uniqueAgentName('Error Test'));

    await page.getByRole('button', { name: 'Create agent' }).click();

    await expect(page.getByText(/Failed to create agent/i)).toBeVisible({ timeout: 10000 });

    // Should stay on create sub-page with button still enabled
    await expect(page).toHaveURL(/\/cms\/agents\/create/);
    await expect(page.getByRole('button', { name: 'Create agent' })).toBeEnabled();
  });
});

test.describe('Form Reset After Creation', () => {
  test('shows clean form when navigating back to create page', async ({ page }) => {
    await page.goto('/cms/agents/create');

    const agentName = uniqueAgentName('Reset Test');
    await fillRequiredFields(page, agentName);

    await createAgentAndGetId(page);

    // Navigate back to create page
    await page.goto('/cms/agents/create');

    // Form should be empty
    await expect(page.locator('#agent-name')).toHaveValue('');
    await expect(page.locator('#agent-description')).toHaveValue('');
  });
});
