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
    await expect(page.getByRole('option', { name: 'Workflow Agent' })).toBeVisible();

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

    // All five agents should appear as links
    await expect(page.getByRole('link', { name: 'Test Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Helper Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Network Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approval Agent' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Workflow Agent' })).toBeVisible();

    // Grid columns: Name(1), Instructions(2), Model(3), Workflows(4), Agents(5), Tools(6)
    // Network Agent has 1 agent (helperAgent)
    const networkLink = page.getByRole('link', { name: 'Network Agent' });
    await expect(networkLink.locator(':scope > span:nth-child(5)')).toHaveText('1');

    // Helper Agent has 1 tool
    const helperLink = page.getByRole('link', { name: 'Helper Agent' });
    await expect(helperLink.locator(':scope > span:nth-child(6)')).toHaveText('1');

    // Workflow Agent has 1 workflow
    const workflowLink = page.getByRole('link', { name: 'Workflow Agent' });
    await expect(workflowLink.locator(':scope > span:nth-child(4)')).toHaveText('1');
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

    // The expanded content should contain the sub-agent's response about mangoes
    await expect(agentBadge).toContainText(/mango/i);

    // The final assistant response should contain the delegated result
    const assistantMsg = await waitForAssistantMessage(page);
    await expect(assistantMsg).toBeVisible({ timeout: 30_000 });
    await expect(assistantMsg).toContainText(/mango/i);
  });

  test('workflow-agent triggers workflow and workflow badge renders in chat', async ({ page }) => {
    await page.goto('/agents/workflow-agent/chat/new');

    // Verify the overview shows the workflow is attached
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: 'sequential-steps' })).toBeVisible();

    // Send a message that triggers the workflow
    await fillAndSend(page, 'Greet someone named Alice');

    // Wait for navigation to thread URL
    await expect(page).toHaveURL(/\/chat\/(?!new)/, { timeout: 20_000 });

    // The workflow call should render as a WorkflowBadge in the chat thread
    const thread = page.getByTestId('thread-wrapper');
    const workflowBadge = thread.getByTestId('workflow-badge');
    await expect(workflowBadge).toBeVisible({ timeout: 30_000 });

    // The badge title should show the workflow name
    await expect(workflowBadge).toContainText(/sequential/i);

    // Workflow badge starts expanded — verify navigation links and the workflow graph
    await expect(workflowBadge.getByRole('link', { name: 'Go to workflow' })).toBeVisible();

    // The graph should render step nodes from the sequential-steps workflow
    await expect(workflowBadge.getByText('add-greeting')).toBeVisible();
    await expect(workflowBadge.getByText('add-farewell')).toBeVisible();
    await expect(workflowBadge.getByText('combine-messages')).toBeVisible();

    // The final assistant response should contain the workflow's combined output.
    // sequential-steps produces "Hello, <name>! Goodbye, <name>!" — assert both
    // halves to prove the result came from the workflow, not a generic LLM response.
    const assistantMsg = await waitForAssistantMessage(page);
    await expect(assistantMsg).toBeVisible({ timeout: 30_000 });
    await expect(assistantMsg).toContainText(/Hello,?\s*Alice/i);
    await expect(assistantMsg).toContainText(/Goodbye,?\s*Alice/i);
  });
});
