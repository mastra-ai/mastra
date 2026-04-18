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
 * team library, and configure settings — instead of the full admin Studio.
 * BEHAVIOR UNDER TEST: /system/packages reports agentBuilderEnabled + config,
 * and the sidebar honors the role and the server config to render the right
 * sections with the right links.
 */

test.describe('Agent Studio sidebar — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('non-admin member sees flat Agents / Projects / Library / Configure links', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    // The simplified end-user sidebar exposes four top-level links.
    const agentsLink = page.locator('nav a[href="/agent-studio/agents"]');
    const projectsLink = page.locator('nav a[href="/agent-studio/projects"]');
    const libraryLink = page.locator('nav a[href="/agent-studio/library"]');
    const configureLink = page.locator('nav a[href="/agent-studio/configure"]');

    await expect(agentsLink.first()).toBeVisible();
    await expect(projectsLink.first()).toBeVisible();
    await expect(libraryLink.first()).toBeVisible();
    await expect(configureLink.first()).toBeVisible();

    // Clicking the Library link navigates to the library landing route.
    await libraryLink.first().click();
    await expect(page).toHaveURL(/\/agent-studio\/library(\/agents)?$/);
  });

  test('admin without preview toggle does NOT see the end-user sidebar', async ({ page }) => {
    await setupMockAuth(page, { role: 'admin' });

    await page.goto('/');

    // Admin should land on the regular Studio sidebar — the end-user Projects
    // top-level link from the Agent Studio sidebar must not be present.
    const projectsLink = page.locator('nav a[href="/agent-studio/projects"]');
    await expect(projectsLink).toHaveCount(0);
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

    // The Create entry points to the Agent Studio create page so end-users
    // with stored-agents:write can author a new stored agent without leaving
    // the Studio shell.
    const createLink = page.locator('a[href="/agent-studio/agents/create"]');
    await expect(createLink.first()).toBeVisible();
  });
});

/**
 * FEATURE: Agent Studio recents tracking
 * BEHAVIOR UNDER TEST: opening an agent via /agent-studio/agents/:id/chat
 * persists the agent as a recent in localStorage (keyed by user id). The
 * simplified sidebar no longer surfaces recents directly, but the underlying
 * tracking behavior is still exercised by the agents list page.
 */

test.describe('Agent Studio recents — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('opening an agent via the studio chat route records a recent in localStorage', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    // Seed a stored agent owned by the mock member. Stored agents are created
    // in draft status, so we also need to publish it (via version activation)
    // so it appears in the default /stored/agents query the studio joins
    // against.
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

    // Start on an agent-studio page so the member user is loaded into the
    // recents hook's localStorage key.
    await page.goto('/agent-studio/agents');
    await expect(page.getByRole('heading', { name: 'Agents' }).first()).toBeVisible();

    // Open the studio chat route — this mounts the recents tracker.
    await page.goto(`/agent-studio/agents/${agentId}/chat`);

    // The recents hook writes to localStorage keyed by the authenticated user.
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.localStorage.getItem('mastra.agentStudio.recents.user_member_456') ?? ''),
        { timeout: 15000 },
      )
      .toContain(agentId);
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
