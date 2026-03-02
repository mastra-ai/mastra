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
async function clickCreateSidebarLink(page: Page, linkName: string) {
  const pathSuffix = SIDEBAR_PATHS[linkName];
  if (pathSuffix === undefined) throw new Error(`Unknown sidebar link: ${linkName}`);
  const href = `/cms/agents/create${pathSuffix}`;
  const link = page.locator(`a[href="${href}"]`);
  await link.click();
  await page.waitForTimeout(500);
}

// Fill the identity fields on the create page
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

  await clickCreateSidebarLink(page, 'Instructions');
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.type('You are a helpful test agent.');
}

// Create agent and extract ID from redirect URL
async function createAgentAndGetId(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Create agent' }).click();

  await expect(page).toHaveURL(/\/agents\/[a-zA-Z0-9-]+\/chat/, { timeout: 30000 });

  const url = page.url();
  const agentId = url.split('/agents/')[1]?.split('/')[0];
  if (!agentId) throw new Error('Could not extract agent ID from URL: ' + url);
  return agentId;
}

// Navigate directly to an edit sub-page (full page load, for verification).
async function goToEditSubPage(page: Page, agentId: string, subPage = '') {
  await page.goto(`/cms/agents/${agentId}/edit${subPage}`);
  await page.locator('#agent-name').waitFor({ state: 'visible', timeout: 15000 });
}

// Navigate to an edit sub-page via sidebar link (client-side navigation).
async function clickEditSidebarLink(page: Page, agentId: string, linkName: string) {
  const pathSuffix = SIDEBAR_PATHS[linkName];
  if (pathSuffix === undefined) throw new Error(`Unknown sidebar link: ${linkName}`);
  const href = `/cms/agents/${agentId}/edit${pathSuffix}`;
  const link = page.locator(`a[href="${href}"]`);
  await link.click();
  await page.waitForTimeout(1000);
}

// Find a provider's toggle switch by name (EntityName -> EntityContent -> header div -> switch)
function getProviderToggle(page: Page, providerName: string) {
  return page.getByText(providerName, { exact: true }).locator('..').locator('..').getByRole('switch');
}

// Save draft on edit page and wait for success
async function saveDraft(page: Page) {
  const saveButton = page.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();
  await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 10000 });
}

test.afterEach(async () => {
  await resetStorage();
});

test.describe('Preprocessors Edit Persistence', () => {
  test('can enable processor on existing agent and save draft', async ({ page }) => {
    // Create agent without processors
    await page.goto('/cms/agents/create');
    const agentName = uniqueAgentName('Edit Processor');
    await fillRequiredFields(page, agentName);
    const agentId = await createAgentAndGetId(page);

    // Navigate to edit page -> Preprocessors
    await goToEditSubPage(page, agentId);
    await expect(page.locator('#agent-name')).not.toHaveValue('', { timeout: 15000 });
    await clickEditSidebarLink(page, agentId, 'Preprocessors');

    // Wait for providers to load
    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });

    // Logging should be unchecked initially
    const loggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(loggingToggle).not.toBeChecked();

    // Enable logging processor
    await loggingToggle.click();
    await expect(loggingToggle).toBeChecked();

    // Save draft
    await saveDraft(page);

    // Reload and verify persistence
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    const editLoggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(editLoggingToggle).toBeChecked({ timeout: 10000 });
    await expect(page.getByText('Process Input')).toBeVisible();
  });

  test('can disable one processor while keeping another on existing agent', async ({ page }) => {
    // Create agent with both processors enabled
    await page.goto('/cms/agents/create');
    const agentName = uniqueAgentName('Disable Processor');
    await fillRequiredFields(page, agentName);

    await clickCreateSidebarLink(page, 'Preprocessors');
    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });
    const loggingToggle = getProviderToggle(page, 'Logging Processor');
    await loggingToggle.click();
    await expect(loggingToggle).toBeChecked();

    const contentToggle = getProviderToggle(page, 'Content Filter Processor');
    await contentToggle.click();
    await expect(contentToggle).toBeChecked();

    const agentId = await createAgentAndGetId(page);

    // Navigate to edit page -> Preprocessors
    await goToEditSubPage(page, agentId);
    await expect(page.locator('#agent-name')).not.toHaveValue('', { timeout: 15000 });
    await clickEditSidebarLink(page, agentId, 'Preprocessors');

    // Both should be enabled
    const editLoggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(editLoggingToggle).toBeChecked({ timeout: 10000 });
    const editContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(editContentToggle).toBeChecked({ timeout: 10000 });

    // Disable logging processor only
    await editLoggingToggle.click();
    await expect(editLoggingToggle).not.toBeChecked();

    // Save draft
    await saveDraft(page);

    // Reload and verify logging is disabled but content filter remains
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    const reloadLoggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(reloadLoggingToggle).not.toBeChecked({ timeout: 10000 });
    const reloadContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(reloadContentToggle).toBeChecked({ timeout: 10000 });
  });

  test('phase changes persist after save draft', async ({ page }) => {
    // Create agent with content filter (both phases enabled)
    await page.goto('/cms/agents/create');
    const agentName = uniqueAgentName('Phase Edit');
    await fillRequiredFields(page, agentName);

    await clickCreateSidebarLink(page, 'Preprocessors');
    await expect(page.getByText('Content Filter Processor', { exact: true })).toBeVisible({ timeout: 10000 });

    const contentToggle = getProviderToggle(page, 'Content Filter Processor');
    await contentToggle.click();
    await expect(contentToggle).toBeChecked();

    // Both phases should be on by default
    await expect(page.getByText('Process Output Result')).toBeVisible({ timeout: 5000 });

    const agentId = await createAgentAndGetId(page);

    // Navigate to edit page -> Preprocessors
    await goToEditSubPage(page, agentId);
    await expect(page.locator('#agent-name')).not.toHaveValue('', { timeout: 15000 });
    await clickEditSidebarLink(page, agentId, 'Preprocessors');

    // Content filter should be enabled with both phases
    const editContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(editContentToggle).toBeChecked({ timeout: 10000 });
    await expect(page.getByText('Process Output Result')).toBeVisible({ timeout: 5000 });

    // Toggle off Process Output Result phase
    const processOutputSwitch = page.getByText('Process Output Result').locator('..').getByRole('switch');
    await processOutputSwitch.click();
    await expect(processOutputSwitch).not.toBeChecked();

    // Save draft
    await saveDraft(page);

    // Reload and verify phase change persisted
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    // Content filter should still be enabled
    const reloadContentToggle = getProviderToggle(page, 'Content Filter Processor');
    await expect(reloadContentToggle).toBeChecked({ timeout: 10000 });

    // Process Output Result should be unchecked
    const reloadProcessOutputSwitch = page.getByText('Process Output Result').locator('..').getByRole('switch');
    await expect(reloadProcessOutputSwitch).not.toBeChecked();
  });

  test('adding processor to existing agent includes it in published version', async ({ page }) => {
    // Create and publish agent without processors
    await page.goto('/cms/agents/create');
    const agentName = uniqueAgentName('Publish Processor');
    await fillRequiredFields(page, agentName);
    const agentId = await createAgentAndGetId(page);

    // Navigate to edit page -> Preprocessors
    await goToEditSubPage(page, agentId);
    await expect(page.locator('#agent-name')).not.toHaveValue('', { timeout: 15000 });
    await clickEditSidebarLink(page, agentId, 'Preprocessors');

    // Enable logging processor
    await expect(page.getByText('Logging Processor', { exact: true })).toBeVisible({ timeout: 10000 });
    const loggingToggle = getProviderToggle(page, 'Logging Processor');
    await loggingToggle.click();
    await expect(loggingToggle).toBeChecked();

    // Save draft first
    await saveDraft(page);

    // Then publish
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Agent published')).toBeVisible({ timeout: 10000 });

    // Navigate back to edit page and verify processor persists
    await page.goto(`/cms/agents/${agentId}/edit/processors`);
    await page.waitForTimeout(2000);

    const editLoggingToggle = getProviderToggle(page, 'Logging Processor');
    await expect(editLoggingToggle).toBeChecked({ timeout: 10000 });
  });
});
