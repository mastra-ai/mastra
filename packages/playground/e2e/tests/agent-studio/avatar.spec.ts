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

// 1x1 transparent PNG
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

/**
 * FEATURE: Agent avatar upload
 * USER STORY: As an agent author, when I upload an avatar for a stored agent
 * it should render on cards and across sessions.
 * BEHAVIOR UNDER TEST: POST /stored/agents/:id/avatar writes to metadata and
 * the agent list reflects the new avatarUrl on reload.
 */

test.describe('Agent avatar upload — behavior', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('uploading an avatar persists on the agent record', async ({ page }) => {
    await setupMockAuth(page, { role: 'member', permissions: END_USER_PERMISSIONS });

    const createResponse = await page.request.post('/api/stored/agents', {
      data: {
        name: 'Avatar Agent',
        description: 'Has an avatar',
        instructions: 'You are a helpful assistant.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
        authorId: 'user_member_456',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = (await createResponse.json()) as { id: string; resolvedVersionId: string };
    const agentId = created.id;

    await page.request.post(`/api/stored/agents/${agentId}/versions/${created.resolvedVersionId}/activate`);

    const uploadResponse = await page.request.post(`/api/stored/agents/${agentId}/avatar`, {
      data: {
        contentBase64: TRANSPARENT_PNG_BASE64,
        contentType: 'image/png',
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const uploadBody = (await uploadResponse.json()) as { avatarUrl: string };
    expect(uploadBody.avatarUrl).toContain('data:image/png;base64,');

    const agentResponse = await page.request.get(`/api/stored/agents/${agentId}`);
    expect(agentResponse.ok()).toBeTruthy();
    const agentBody = (await agentResponse.json()) as {
      metadata?: { avatarUrl?: string };
      avatarUrl?: string;
    };
    const persistedUrl = agentBody.avatarUrl ?? agentBody.metadata?.avatarUrl;
    expect(persistedUrl).toBeTruthy();
    expect(persistedUrl).toContain('data:image/png;base64,');
  });
});
