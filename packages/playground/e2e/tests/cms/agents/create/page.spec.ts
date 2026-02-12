import { test, expect, Page } from '@playwright/test';
import { resetStorage } from '../../../__utils__/reset-storage';

// Helper to generate unique agent names
function uniqueAgentName(prefix = 'Test Agent') {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Helper to fill identity fields on the Information page (name, description, provider, model)
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
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(content);
}

// Helper to fill all required fields with valid data
async function fillRequiredFields(page: Page, agentName?: string) {
  await fillIdentityFields(page, {
    name: agentName || uniqueAgentName(),
    provider: 'OpenAI',
    model: 'gpt-4o-mini',
  });

  await navigateToInstructionBlocksPage(page);
  await fillInstructionBlock(page, 'You are a helpful assistant.');
  await navigateToIdentityPage(page);
}

// Helper to add a new instruction block
async function addInstructionBlock(page: Page) {
  const countBefore = await page.locator('.cm-content').count();
  await page.getByRole('button', { name: 'Add Instruction block' }).click();
  await expect(page.locator('.cm-content')).toHaveCount(countBefore + 1);
}

// Helper to get the CMS sidebar (right side of the layout, not the main app sidebar)
function getCmsSidebar(page: Page) {
  return page.getByRole('main').locator('nav');
}

// Helper to navigate to entity pages via sidebar link clicks (preserves React state)
async function navigateToInstructionBlocksPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Instructions' }).click();
  await expect(page.getByText('Add instruction blocks to your agent')).toBeVisible({ timeout: 5000 });
}

async function navigateToToolsPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Tools' }).click();
  await expect(page.getByText('Select the tools this agent can use')).toBeVisible({ timeout: 5000 });
}

async function navigateToWorkflowsPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Workflows' }).click();
  await expect(page.getByText('Select workflows this agent can trigger')).toBeVisible({ timeout: 5000 });
}

async function navigateToAgentsPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Agents' }).click();
  await expect(page.getByText('Select sub-agents for this agent')).toBeVisible({ timeout: 5000 });
}

async function navigateToScorersPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Scorers' }).click();
  await expect(page.getByText('Configure scorers for evaluating agent responses')).toBeVisible({ timeout: 5000 });
}

async function navigateToMemoryPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Memory' }).click();
  await expect(page.getByText('Configure memory settings')).toBeVisible({ timeout: 5000 });
}

async function navigateToVariablesPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Variables' }).click();
  await expect(page.getByText('Variables are dynamic values')).toBeVisible({ timeout: 5000 });
}

async function navigateToIdentityPage(page: Page) {
  await getCmsSidebar(page).getByRole('link', { name: 'Identity' }).click();
  await expect(page.getByText('Define your agent')).toBeVisible({ timeout: 5000 });
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
  const fieldSelect = page
    .locator('[role="combobox"]')
    .filter({ hasText: /Select field/ })
    .last();
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

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Agent CMS Creation - Agent By ID Page Verification', () => {
  const basePath = '/cms/agents/create';

  // Helper to get the system prompt section on the agent by-id page
  function getSystemPromptSection(page: Page) {
    return page.locator('h3:has-text("System Prompt")').locator('..');
  }

  // Helper to set global request context via the /request-context page
  async function setGlobalRequestContext(page: Page, context: Record<string, string>) {
    const currentUrl = page.url();

    await page.goto('/request-context');
    await expect(page.locator('h1')).toHaveText('Request Context');

    // Fill the CodeMirror JSON editor
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(JSON.stringify(context));

    // Save the request context
    await page.getByRole('button', { name: 'Save' }).click();

    // Clear cached prompt experiment so the agent page picks up fresh server-resolved instructions
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter(key => key.startsWith('agent-prompt-experiment-'))
        .forEach(key => localStorage.removeItem(key));
    });

    // Navigate back to the agent page
    await page.goto(currentUrl);
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 10000 });
  }

  // Helper to create an agent with one conditional block and one unconditional block
  async function createAgentWithConditionalBlocks(page: Page, agentName: string) {
    await page.goto(basePath);

    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    // Navigate to instruction blocks page
    await navigateToInstructionBlocksPage(page);

    // Fill first block with content that will have a display condition
    await fillInstructionBlock(page, 'Admin only content', 0);

    // Add second block with unconditional content (no rule)
    await addInstructionBlock(page);
    await fillInstructionBlock(page, 'Default content', 1);

    // Navigate to Variables page and add a variable
    await navigateToVariablesPage(page);
    await page.getByRole('button', { name: /Add variable/ }).click();
    await page.getByPlaceholder('Variable name').last().fill('userRole');

    // Navigate back to instruction blocks page for display conditions
    await navigateToInstructionBlocksPage(page);

    // Add display condition on the first block: userRole equals admin
    await openDisplayConditions(page, 0);
    await configureRule(page, { field: 'userRole', value: 'admin' });
    await expect(page.getByText('(1 rule)')).toBeVisible();

    // Create the agent
    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });
  }

  // Behavior: Creating an agent persists it and it appears in the agents list
  test('creates agent and shows in agents list', async ({ page }) => {
    await page.goto(basePath);

    const agentName = uniqueAgentName('List Verify');
    await fillRequiredFields(page, agentName);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    await page.goto('/agents');
    await expect(page.getByText(agentName)).toBeVisible();
  });

  // Behavior: Data entered during creation (name, description, instructions) is visible on agent detail page
  test('created agent data is visible on agent by-id page', async ({ page }) => {
    await page.goto(basePath);

    const agentName = uniqueAgentName('Data Verify');
    const description = 'A test agent for data verification';

    await fillIdentityFields(page, {
      name: agentName,
      description,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await navigateToInstructionBlocksPage(page);
    await fillInstructionBlock(page, 'You are a data verification assistant.');

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    // Verify agent name in heading
    await expect(page.getByRole('heading', { name: agentName })).toBeVisible({ timeout: 10000 });

    // Verify description in Overview
    await expect(page.getByText(description)).toBeVisible({ timeout: 10000 });

    // Verify system prompt shows instruction content
    const systemPromptSection = getSystemPromptSection(page);
    await expect(systemPromptSection.getByText('You are a data verification assistant')).toBeVisible({
      timeout: 10000,
    });
  });

  // Behavior: Multiple instruction blocks without rules are concatenated in system prompt
  test('agent with 2 instruction blocks shows both on agent by-id page', async ({ page }) => {
    await page.goto(basePath);

    const agentName = uniqueAgentName('Two Blocks');
    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await navigateToInstructionBlocksPage(page);
    await fillInstructionBlock(page, 'Block 1 content', 0);
    await addInstructionBlock(page);
    await fillInstructionBlock(page, 'Block 2 content', 1);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    const systemPromptSection = getSystemPromptSection(page);
    await expect(systemPromptSection.getByText('Block 1 content')).toBeVisible({ timeout: 10000 });
    await expect(systemPromptSection.getByText('Block 2 content')).toBeVisible({ timeout: 10000 });
  });

  // Behavior: Attached workflows, sub-agents, tools, scorers, and memory appear in Overview
  test('agent with all entity types shows them on agent by-id page', async ({ page }) => {
    await page.goto(basePath);

    const agentName = uniqueAgentName('All Entities');
    await fillIdentityFields(page, {
      name: agentName,
      description: 'Agent with all entity types',
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await navigateToInstructionBlocksPage(page);
    await fillInstructionBlock(page, 'You are a full-featured assistant.');

    // Navigate to Tools page and add a tool
    await navigateToToolsPage(page);
    const toolsCombobox = page.getByRole('combobox').filter({ hasText: /Select tools/ });
    await toolsCombobox.click();
    await page.getByRole('option', { name: /weatherInfo/i }).click();
    await page.keyboard.press('Escape');

    // Navigate to Workflows page and add a workflow
    await navigateToWorkflowsPage(page);
    const workflowsCombobox = page.getByRole('combobox').filter({ hasText: /Select workflows/ });
    await workflowsCombobox.click();
    await page.getByRole('option', { name: /lessComplexWorkflow/i }).click();
    await page.keyboard.press('Escape');

    // Navigate to Agents page and add a sub-agent
    await navigateToAgentsPage(page);
    const agentsCombobox = page.getByRole('combobox').filter({ hasText: /Select sub-agents/ });
    await agentsCombobox.click();
    await page.getByRole('option', { name: /Weather Agent/i }).click();
    await page.keyboard.press('Escape');

    // Navigate to Scorers page and add a scorer
    await navigateToScorersPage(page);
    const scorersCombobox = page.getByRole('combobox').filter({ hasText: /Select scorers/ });
    await scorersCombobox.click();
    await page.getByRole('option', { name: /Response Quality/i }).click();
    await page.keyboard.press('Escape');

    // Navigate to Memory page and enable memory
    await navigateToMemoryPage(page);
    await page.getByRole('switch', { name: /Enable Memory/i }).click();

    // Create agent
    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 20000 });

    // Verify all entities in Overview
    const toolsSection = page.locator('h3:has-text("Tools")').locator('..');
    await expect(toolsSection.getByText('weatherInfo')).toBeVisible({ timeout: 10000 });

    const workflowsSection = page.locator('h3:has-text("Workflows")').locator('..');
    await expect(workflowsSection.getByText('lessComplexWorkflow')).toBeVisible({ timeout: 10000 });

    const agentsSection = page.locator('h3:has-text("Agents")').locator('..');
    await expect(agentsSection.getByText('Weather Agent')).toBeVisible({ timeout: 10000 });

    const scorersSection = page.locator('h3:has-text("Scorers")').locator('..');
    await expect(scorersSection.getByText(/Response Quality/i)).toBeVisible({ timeout: 10000 });

    const memorySection = page.locator('h3:has-text("Memory")').locator('..');
    await expect(memorySection.getByText('On')).toBeVisible({ timeout: 10000 });
  });

  // Behavior: Without variables/rules, all blocks show concatenated in system prompt
  test('multiple instruction blocks without variables concatenate in system prompt', async ({ page }) => {
    await page.goto(basePath);

    const agentName = uniqueAgentName('Concat Blocks');
    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    await navigateToInstructionBlocksPage(page);
    await fillInstructionBlock(page, 'First block instructions', 0);
    await addInstructionBlock(page);
    await fillInstructionBlock(page, 'Second block instructions', 1);

    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page).toHaveURL(/\/agents\/[a-z0-9-]+\/chat/, { timeout: 15000 });

    const systemPromptSection = getSystemPromptSection(page);
    await expect(systemPromptSection.getByText('First block instructions')).toBeVisible({ timeout: 10000 });
    await expect(systemPromptSection.getByText('Second block instructions')).toBeVisible({ timeout: 10000 });
  });

  // Behavior: Blocks with rules that don't match the request context are hidden; blocks without rules always show
  test('multiple instruction blocks with rules show only unconditional block when context does not match', async ({
    page,
  }) => {
    const agentName = uniqueAgentName('Cond No Match');
    await createAgentWithConditionalBlocks(page, agentName);

    // On agent by-id page, verify System Prompt shows ONLY the unconditional block
    const systemPromptSection = getSystemPromptSection(page);
    await expect(systemPromptSection.getByText('Default content')).toBeVisible({ timeout: 10000 });
    // The conditional block should NOT appear because no request context is set
    await expect(systemPromptSection.getByText('Admin only content')).not.toBeVisible();
  });

  // Behavior: Setting request context that matches rules shows matching conditional blocks PLUS unconditional blocks
  test('multiple instruction blocks with rules and valid request context shows all matching blocks', async ({
    page,
  }) => {
    const agentName = uniqueAgentName('Cond Match');
    await createAgentWithConditionalBlocks(page, agentName);

    // Set global request context to match the rule
    await setGlobalRequestContext(page, { userRole: 'admin' });

    // Verify System Prompt now shows both blocks
    const systemPromptSection = getSystemPromptSection(page);
    await expect(systemPromptSection.getByText('Admin only content')).toBeVisible({ timeout: 10000 });
    await expect(systemPromptSection.getByText('Default content')).toBeVisible({ timeout: 10000 });
  });

  // Behavior: Form data persists when navigating between routes
  test('form data persists when navigating between routes', async ({ page }) => {
    await page.goto(basePath);

    const agentName = uniqueAgentName('Persist Test');
    await fillIdentityFields(page, {
      name: agentName,
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
    });

    // Navigate to tools page and back via sidebar clicks (client-side navigation)
    await navigateToToolsPage(page);
    await navigateToIdentityPage(page);

    // Verify the name field still has the value
    await expect(page.getByLabel('Name')).toHaveValue(agentName);
  });

  // Behavior: Sidebar highlights active route correctly
  test('sidebar highlights active route', async ({ page }) => {
    await page.goto(basePath);

    // Identity link should be active (it's the index route)
    const cmsSidebar = getCmsSidebar(page);
    const identityLink = cmsSidebar.getByRole('link', { name: 'Identity' });
    await expect(identityLink).toBeVisible();

    // Navigate to tools and check tools link is active
    await navigateToToolsPage(page);
    const toolsLink = cmsSidebar.getByRole('link', { name: 'Tools' });
    await expect(toolsLink).toBeVisible();
  });
});
