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
];

/**
 * FEATURE: Marketplace visibility
 * USER STORY: As a team member browsing the Marketplace, I should only see
 * items that have been explicitly shared (metadata.visibility === 'public').
 * BEHAVIOR UNDER TEST: Marketplace > Agents filters by metadata.visibility,
 * so a private agent authored by someone else is NOT listed, but flipping
 * it to public via the same API surfaces it.
 */

test.describe('Marketplace visibility — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('private agent is hidden from the marketplace; public agent appears', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    // Seed an agent authored by someone else, initially private.
    const createResponse = await page.request.post('/api/stored/agents', {
      data: {
        name: 'Private Marketplace Agent',
        description: 'Not yet shared',
        instructions: 'Private agent instructions.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
        authorId: 'user_admin_123',
        metadata: { visibility: 'private' },
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { id: string; resolvedVersionId: string };
    const agentId = created.id;

    const activateResponse = await page.request.post(
      `/api/stored/agents/${agentId}/versions/${created.resolvedVersionId}/activate`,
    );
    expect(activateResponse.ok()).toBeTruthy();

    await page.goto('/agent-studio/marketplace/agents');
    await expect(page.getByText('Private Marketplace Agent')).toHaveCount(0);

    // Flip to public via the same metadata update Share to Marketplace performs.
    const updateResponse = await page.request.patch(`/api/stored/agents/${agentId}`, {
      data: { metadata: { visibility: 'public' } },
    });
    expect(updateResponse.ok()).toBeTruthy();

    await page.goto('/agent-studio/marketplace/agents');
    await expect(page.getByText('Private Marketplace Agent').first()).toBeVisible();
  });
});
