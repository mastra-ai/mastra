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
 * FEATURE: User preferences API gating
 * USER STORY: As a team member, when no auth provider is configured the
 * preferences API must reject anonymous writes (so we never persist cross-
 * user state to a shared bucket).
 * BEHAVIOR UNDER TEST: PATCH /user/preferences returns 401 when the server
 * has no auth provider wired.
 */

test.describe('User preferences API gating', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('PATCH /user/preferences rejects anonymous requests with 401', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    const response = await page.request.patch('/api/user/preferences', {
      data: { agentStudio: { starredAgents: ['some-agent'] } },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /user/preferences rejects anonymous requests with 401', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    const response = await page.request.get('/api/user/preferences');
    expect(response.status()).toBe(401);
  });

  test('studio sidebar renders even when preferences are unavailable (server has no auth provider)', async ({
    page,
  }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    await page.goto('/agent-studio/agents');

    // Sidebar should still render its flat top-level links even when the
    // preferences fetch 401s — we fall back to empty starred lists.
    await expect(page.locator('nav a[href="/agent-studio/agents"]').first()).toBeVisible();
    await expect(page.locator('nav a[href="/agent-studio/library"]').first()).toBeVisible();
    await expect(page.locator('nav a[href="/agent-studio/configure"]').first()).toBeVisible();
  });
});
