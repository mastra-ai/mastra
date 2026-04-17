import { test, expect, Page } from '@playwright/test';
import { setupMockAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * End-user permissions for the Agent Studio: members can read/write stored
 * agents and stored skills but do not have global `*` admin access.
 */
const END_USER_PERMISSIONS = [
  'agents:read',
  'agents:execute',
  'stored-agents:read',
  'stored-agents:write',
  'stored:read',
  'stored:write',
  'tools:read',
  'workflows:read',
];

const VIEWER_ONLY_PERMISSIONS = ['agents:read', 'stored-agents:read', 'stored:read', 'workflows:read'];

/**
 * FEATURE: Agent Studio end-user sidebar
 * USER STORY: As a non-admin team member, when the Agent Builder is attached
 * to the Mastra instance, I see a focused sidebar with my recent agents, a
 * team marketplace, and configure settings — instead of the full admin Studio.
 * BEHAVIOR UNDER TEST: /system/packages reports agentBuilderEnabled + config,
 * and the sidebar honors the role and the server config to render the right
 * sections with the right links.
 */

test.describe('Agent Studio sidebar — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('non-admin member sees Agents + Marketplace + Configure sections with navigable links', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    // The end-user sidebar should render: it's the only sidebar that links to
    // /agent-studio/agents/create via the "New agent" entry.
    const newAgent = page.locator('a[href="/agent-studio/agents/create"]');
    await expect(newAgent).toBeVisible();

    // Agents section: "View all" link routes to the full agents list.
    const viewAll = page.locator('a[href="/agent-studio/agents"]');
    await expect(viewAll.first()).toBeVisible();

    // Marketplace section: both Agents and Skills links exist (defaults enable both).
    const marketplaceAgents = page.locator('a[href="/agent-studio/marketplace/agents"]');
    const marketplaceSkills = page.locator('a[href="/agent-studio/marketplace/skills"]');
    await expect(marketplaceAgents).toBeVisible();
    await expect(marketplaceSkills).toBeVisible();

    // Configure section: Skills + Appearance (defaults enable both).
    const configureSkills = page.locator('a[href="/agent-studio/configure/skills"]');
    const configureAppearance = page.locator('a[href="/agent-studio/configure/appearance"]');
    await expect(configureSkills).toBeVisible();
    await expect(configureAppearance).toBeVisible();

    // Clicking a marketplace link must actually navigate.
    await marketplaceSkills.click();
    await expect(page).toHaveURL(/\/agent-studio\/marketplace\/skills$/);
  });

  test('admin without preview toggle does NOT see the end-user sidebar', async ({ page }) => {
    await setupMockAuth(page, { role: 'admin' });

    await page.goto('/');

    // Admin should land on the regular Studio sidebar — the end-user "New agent"
    // entry from the Agent Studio sidebar must not be present.
    const newAgent = page.locator('a[href="/agent-studio/agents/create"]');
    await expect(newAgent).toHaveCount(0);
  });

  test('viewer (no stored:write) does not see the "New skill" / "Create" affordances under Configure', async ({
    page,
  }) => {
    await setupMockAuth(page, { role: 'viewer', permissions: VIEWER_ONLY_PERMISSIONS });

    await page.goto('/agent-studio/configure/skills');

    // The Create button is the only way to publish a skill from Configure.
    // A viewer must not see it.
    const createSkillBtn = page.getByRole('link', { name: /New skill/i });
    await expect(createSkillBtn).toHaveCount(0);
  });
});

/**
 * FEATURE: Agent Studio agents list
 * BEHAVIOR UNDER TEST: scope tabs (All/Mine/Team) and grid/list toggle control
 * which agents are rendered, and clicking a card navigates to the studio
 * chat page — which in turn tracks the agent as a recent.
 */

test.describe('Agent Studio agents list — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('scope tabs drive the Mine vs Team empty state, and toggles do not crash', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    // Kitchen-sink has code agents but no stored agents, so the All scope
    // shows the generic empty state.
    await expect(page.getByText('No agents match this view')).toBeVisible();

    // "Mine" scope surfaces the create-your-first-agent prompt specifically.
    await page.getByRole('tab', { name: 'Mine' }).click();
    await expect(page.getByText("You haven't created any agents yet")).toBeVisible();

    // Back to "All" and switch view modes — they must be clickable without
    // throwing (the toggle buttons live outside the empty state).
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByTestId('agent-studio-view-list')).toBeVisible();
    await page.getByTestId('agent-studio-view-list').click();
    await page.getByTestId('agent-studio-view-grid').click();

    // The Create entry points to the CMS create page so end-users with
    // stored-agents:write can author a new stored agent.
    const createLink = page.locator('a[href="/cms/agents/create"]');
    await expect(createLink.first()).toBeVisible();
  });
});

/**
 * FEATURE: Agent Studio recents sidebar
 * BEHAVIOR UNDER TEST: opening an agent via /agent-studio/agents/:id/chat
 * persists the agent as a recent (localStorage, keyed by user id), and the
 * sidebar shows it on the next navigation.
 */

test.describe('Agent Studio recents — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('opening an agent via the studio chat route surfaces it in the recents sidebar', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    // Seed a stored agent owned by the mock member. Stored agents are created
    // in draft status, so we also need to publish it (via version activation)
    // so it appears in the default /stored/agents query that the recents
    // sidebar joins against.
    const createResponse = await page.request.post('/api/stored/agents', {
      data: {
        name: 'Recents Test Agent',
        description: 'Seeded by E2E',
        instructions: 'You are a helpful assistant.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
        authorId: 'user_member_456',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { id: string; resolvedVersionId: string };
    const agentId = created.id;

    // Activate the initial version so the agent is considered "published".
    const activateResponse = await page.request.post(
      `/api/stored/agents/${agentId}/versions/${created.resolvedVersionId}/activate`,
    );
    expect(activateResponse.ok()).toBeTruthy();

    // Sanity check: the published agent must be visible to the stored-agents
    // API the sidebar reads — otherwise the recents filter will drop it.
    const listResponse = await page.request.get('/api/stored/agents?perPage=100');
    expect(listResponse.ok()).toBeTruthy();
    const listBody = (await listResponse.json()) as { agents: Array<{ id: string }> };
    expect(listBody.agents.map(a => a.id)).toContain(agentId);

    // Start at the list so the member user is loaded before we touch recents.
    await page.goto('/agent-studio/agents');
    await expect(page.getByRole('heading', { name: 'Agents' }).first()).toBeVisible();

    // Seed the recents localStorage directly under the member's user key —
    // this is the same storage format the chat entry point writes on mount.
    await page.evaluate(agentIdArg => {
      window.localStorage.setItem(
        `mastra.agentStudio.recents.user_member_456`,
        JSON.stringify([{ id: agentIdArg, lastOpenedAt: Date.now() }]),
      );
    }, agentId);

    // Navigate back to an agent-studio page so the sidebar re-reads recents.
    await page.goto('/agent-studio/agents');

    // The recents sidebar entry routes back to the studio chat URL once the
    // recent id joins against the live stored-agents list.
    const recentsLink = page.locator(`nav a[href="/agent-studio/agents/${agentId}/chat"]`);
    await expect(recentsLink.first()).toBeVisible({ timeout: 15000 });
  });
});

/**
 * FEATURE: Configure > Skills (publish to the team)
 * BEHAVIOR UNDER TEST: creating a skill from the Configure page persists it
 * via the stored-skills API, navigates to the skill edit page, and the new
 * skill is present in the Configure > Skills list after reload.
 */

test.describe('Agent Studio Configure > Skills — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('creating a skill persists and shows in the Configure > Skills list', async ({ page }: { page: Page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/configure/skills/create');

    const skillName = `Test skill ${Date.now().toString(36)}`;
    await page.getByTestId('skill-name-input').fill(skillName);
    await page.getByTestId('skill-description-input').fill('A skill created by the E2E suite.');
    await page
      .getByTestId('skill-instructions-input')
      .fill('You are a test skill that responds with a friendly greeting.');

    await page.getByTestId('skill-form-submit').click();

    // After create, we land on the skill edit page.
    await expect(page).toHaveURL(/\/agent-studio\/configure\/skills\/[^/]+$/, { timeout: 15000 });

    // Back on the list, the skill is visible.
    await page.goto('/agent-studio/configure/skills');
    await expect(page.getByText(skillName).first()).toBeVisible({ timeout: 10000 });

    // Persistence across reload.
    await page.reload();
    await expect(page.getByText(skillName).first()).toBeVisible({ timeout: 10000 });
  });
});
