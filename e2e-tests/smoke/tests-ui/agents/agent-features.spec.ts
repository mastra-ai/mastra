import { test, expect } from '@playwright/test';
import { fillAndSend, waitForAssistantMessage } from '../helpers';

test.describe('Agent Features', () => {
  test('model settings tab shows controls and persists chat method', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Switch to Model Settings tab
    await page.getByRole('tab', { name: 'Model Settings' }).click();

    // Chat Method radio group
    await expect(page.getByRole('radio', { name: 'Generate' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Stream' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Network' })).toBeVisible();

    // Stream should be selected by default
    await expect(page.getByRole('radio', { name: 'Stream' })).toBeChecked();

    // Require Tool Approval checkbox
    await expect(page.getByRole('checkbox')).toBeVisible();

    // Temperature and Top P sliders
    await expect(page.getByText('Temperature')).toBeVisible();
    await expect(page.getByText('Top P')).toBeVisible();

    // Advanced Settings collapsible
    await expect(page.getByRole('button', { name: 'Advanced Settings' })).toBeVisible();

    // Reset button
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();

    // Switch to Generate and verify it sticks
    await page.getByRole('radio', { name: 'Generate' }).click();
    await expect(page.getByRole('radio', { name: 'Generate' })).toBeChecked();
  });

  test('tracing options tab shows JSON editor', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // Switch to Tracing Options tab
    await page.getByRole('tab', { name: 'Tracing Options' }).click();

    // Heading (h3 inside the tab panel)
    await expect(page.getByRole('heading', { name: 'Tracing Options', level: 3 })).toBeVisible();

    // CodeMirror editor should be present
    const editor = page.getByRole('textbox').and(page.locator('.cm-content'));
    await expect(editor).toBeVisible();
  });

  test('model settings: network mode enabled only with sub-agents and memory', async ({ page }) => {
    // networkAgent has both memory and sub-agents — Network should be enabled
    await page.goto('/agents/network-agent/chat/new');
    await page.getByRole('tab', { name: 'Model Settings' }).click();

    const networkRadio = page.getByRole('radio', { name: 'Network' });
    await expect(networkRadio).toBeVisible();
    await expect(networkRadio).toBeEnabled();

    // testAgent has memory but no sub-agents — Network should be disabled
    await page.goto('/agents/test-agent/chat/new');
    await page.getByRole('tab', { name: 'Model Settings' }).click();

    const disabledNetworkRadio = page.getByRole('radio', { name: 'Network' });
    await expect(disabledNetworkRadio).toBeVisible();
    await expect(disabledNetworkRadio).toBeDisabled();
  });

  test('model settings: advanced settings expand and show fields', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');
    await page.getByRole('tab', { name: 'Model Settings' }).click();

    // Expand advanced settings
    await page.getByRole('button', { name: 'Advanced Settings' }).click();

    // Verify advanced fields are visible
    await expect(page.getByText('Frequency Penalty')).toBeVisible();
    await expect(page.getByText('Presence Penalty')).toBeVisible();
    await expect(page.getByText('Max Tokens')).toBeVisible();
    await expect(page.getByText('Max Steps')).toBeVisible();
  });

  test('agent selector switches between agents', async ({ page }) => {
    await page.goto('/agents/test-agent/chat/new');

    // The combobox shows "Test Agent"
    const agentSelector = page.getByRole('combobox').filter({ hasText: 'Test Agent' });
    await expect(agentSelector).toBeVisible();

    // Click to open the agent dropdown
    await agentSelector.click();

    // Should see other agents in the dropdown
    await expect(page.getByRole('option', { name: 'Approval Agent' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Helper Agent' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Network Agent' })).toBeVisible();

    // Select Helper Agent
    await page.getByRole('option', { name: 'Helper Agent' }).click();

    // Should navigate to the helper agent page
    await expect(page).toHaveURL(/\/agents\/helper-agent/);
    await expect(page.locator('h2:has-text("Helper Agent")')).toBeVisible();
  });

  test('network-agent overview shows sub-agents section', async ({ page }) => {
    await page.goto('/agents/network-agent/chat/new');

    // Overview tab should be selected
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    // Sub-agents section with "Agents" heading
    await expect(page.getByRole('heading', { name: 'Agents', level: 3 })).toBeVisible();

    // Helper Agent should be listed as a sub-agent
    await expect(page.getByText('Helper Agent')).toBeVisible();

    // Click to navigate to the sub-agent
    await page.getByRole('link', { name: 'Helper Agent' }).click();
    await expect(page).toHaveURL(/\/agents\/helper-agent/);
    await expect(page.locator('h2:has-text("Helper Agent")')).toBeVisible();
  });

  test('agents list shows all agents with correct attached entities', async ({ page }) => {
    await page.goto('/agents');

    // All four agents should appear
    await expect(page.getByRole('link', { name: 'Test Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Helper Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Network Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approval Agent' })).toBeVisible();

    // Network Agent row shows 1 agent (helperAgent)
    const networkRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Network Agent' }) });
    await expect(networkRow.getByText('1 agent')).toBeVisible();

    // Helper Agent row shows 0 agents, 1 tool
    const helperRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Helper Agent' }) });
    await expect(helperRow.getByText('0 agents')).toBeVisible();
    await expect(helperRow.getByText('1 tool')).toBeVisible();
  });

  test('network-agent delegates to helper-agent via sub-agent call', async ({ page }) => {
    await page.goto('/agents/network-agent/chat/new');

    // Stream is default — send a message that triggers delegation to the helper sub-agent
    await fillAndSend(page, 'Ask your helper agent to say the word "mango" and nothing else.');

    // Wait for navigation to thread URL
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });

    // The sub-agent call should render as an AgentBadge in the chat thread
    const thread = page.getByTestId('thread-wrapper');
    const agentBadge = thread.getByTestId('agent-badge');
    await expect(agentBadge).toBeVisible({ timeout: 30_000 });

    // The badge should show the helper-agent id
    await expect(agentBadge).toContainText(/helper-agent/i);

    // Expand the badge to reveal its inner content
    await agentBadge.getByRole('button').first().click();
    const badgeContent = agentBadge.locator('.bg-surface2');
    await expect(badgeContent).toBeVisible();

    // The expanded content should have meaningful sub-agent output (not be empty)
    await expect(badgeContent).not.toBeEmpty();
    await expect(badgeContent).toContainText(/mango/i);

    // The final assistant response should contain the delegated result
    const assistantMsg = await waitForAssistantMessage(page);
    await expect(assistantMsg).toBeVisible({ timeout: 30_000 });
    await expect(assistantMsg).toContainText(/mango/i);
  });
});
