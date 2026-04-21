import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

const END_USER_PERMISSIONS = [
  'agents:read',
  'agents:execute',
  'stored-agents:read',
  'stored-agents:write',
  'stored:read',
  'stored:write',
  'tools:read',
  'workflows:read',
  'user:write',
];

/**
 * FEATURE: Agent Studio end-user agent creation
 * USER STORY: As a non-admin member, when I create an agent from the Agent
 * Studio, I stay inside the Studio shell, the agent is attributed to me, and
 * it shows up in my "Mine" list immediately without needing to manually
 * publish a version.
 * BEHAVIOR UNDER TEST:
 *   1. "New agent" on the Agents page routes to /agent-studio/agents/create
 *      (not /cms/agents/create).
 *   2. After creating via the API with authorId + auto-publish, the resulting
 *      agent appears in the default (published-only) stored-agents list.
 */

test.describe('Agent Studio agent creation — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('the "New agent" button on the Agents page routes to the Agent Studio create page', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    const createLink = page.locator('a[href="/agent-studio/agents/create"]');
    await expect(createLink.first()).toBeVisible();
  });

  test('agents created with authorId + auto-publish appear in the default stored-agents list', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    const unique = Math.random().toString(36).slice(2, 8);
    const agentName = `studio agent ${unique}`;
    const authorId = 'studio-member-001';

    // Create a stored agent via the API. We mirror what the Agent Studio
    // create page does: include `authorId` and then activate the first
    // version so it shows up in default (published-only) lists.
    const createResponse = await page.request.post('/api/stored/agents', {
      data: {
        name: agentName,
        description: 'from e2e',
        instructions: 'test',
        model: { provider: 'openai', name: 'gpt-4o' },
        authorId,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { id: string };

    const versionsResponse = await page.request.get(
      `/api/stored/agents/${created.id}/versions?sortDirection=DESC&perPage=1`,
    );
    expect(versionsResponse.ok()).toBeTruthy();
    const { versions } = (await versionsResponse.json()) as { versions: Array<{ id: string }> };
    expect(versions.length).toBeGreaterThan(0);
    const activateResponse = await page.request.post(
      `/api/stored/agents/${created.id}/versions/${versions[0].id}/activate`,
    );
    expect(activateResponse.ok()).toBeTruthy();

    // Default list (status=published) should now include the new agent and
    // carry the authorId so the Agent Studio "Mine" scope can match.
    const listResponse = await page.request.get('/api/stored/agents?perPage=100');
    expect(listResponse.ok()).toBeTruthy();
    const listBody = (await listResponse.json()) as { agents: Array<{ id: string; authorId?: string }> };
    const row = listBody.agents.find(a => a.id === created.id);
    expect(row).toBeDefined();
    expect(row?.authorId).toBe(authorId);
  });

  test('the Create form hides Agents, Scorers, Workflows, and Memory sections', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents/create');

    // Wait for the create shell to render.
    await expect(page.getByRole('heading', { name: 'Create an agent' })).toBeVisible();

    const base = '/agent-studio/agents/create';

    // Sections that should remain in the simplified Create flow.
    await expect(page.locator(`nav a[href="${base}"]`)).toBeVisible();
    await expect(page.locator(`nav a[href="${base}/instruction-blocks"]`)).toBeVisible();
    await expect(page.locator(`nav a[href="${base}/tools"]`)).toBeVisible();
    await expect(page.locator(`nav a[href="${base}/skills"]`)).toBeVisible();
    await expect(page.locator(`nav a[href="${base}/variables"]`)).toBeVisible();

    // Sections that must NOT appear on Create.
    await expect(page.locator(`nav a[href="${base}/agents"]`)).toHaveCount(0);
    await expect(page.locator(`nav a[href="${base}/scorers"]`)).toHaveCount(0);
    await expect(page.locator(`nav a[href="${base}/workflows"]`)).toHaveCount(0);
    await expect(page.locator(`nav a[href="${base}/memory"]`)).toHaveCount(0);
  });

  test('the Create form surfaces an avatar picker on the Identity page', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents/create');

    await expect(page.getByRole('heading', { name: 'Create an agent' })).toBeVisible();
    await expect(page.getByTestId('agent-avatar-input')).toBeVisible();
  });
});
