import { afterEach, describe, expect, it, vi } from 'vitest';

import { factoryPack, ownerPack, SESSION_ID, setupSessionModelRoutes } from './__tests__/session-model-test-fixture.js';

afterEach(() => vi.restoreAllMocks());

describe('session-owner model catalog', () => {
  it.each(['user', 'hybrid'] as const)(
    'uses the owner catalog and default for a collaborator in %s scope',
    async scope => {
      const { app, project } = await setupSessionModelRoutes(scope);
      // The session runs under its Factory's resource; it is found by its session id.
      const response = await app.request(
        `/web/config/models?sessionId=${SESSION_ID}&resourceId=${project.id}&threadId=chat-thread&scope=org&userId=viewer`,
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.modelScope).toBe('user');
      expect(body.defaultModelId).toBe('anthropic/claude-opus-4-6');
      expect(body.personalThinkingLevel).toBe('high');
      expect(body).toMatchObject({
        modelPacks: [ownerPack],
        defaultModelPackId: 'owner-pack',
        modelSelection: { kind: 'model' },
      });
      expect(body).not.toHaveProperty('fallbackModelId');
      expect(body.models).toEqual([
        expect.objectContaining({ id: 'anthropic/claude-opus-4-6', credentialLabel: 'Anthropic API key' }),
      ]);
      expect(JSON.stringify(body)).not.toContain('secret');
    },
  );

  it.each(['active', 'revoked'] as const)(
    'uses only the Factory catalog and default for a hybrid %s work-item thread',
    async status => {
      const { app, seed, project, bind } = await setupSessionModelRoutes();
      await bind();
      if (status === 'revoked')
        await seed.workItems.revokeRunBindingsForWorkItem({
          orgId: 'org-1',
          factoryProjectId: project.id,
          workItemId: (await seed.workItems.findActiveRunBindingByThread({
            orgId: 'org-1',
            resourceId: SESSION_ID,
            sessionId: SESSION_ID,
            threadId: 'run-thread',
          }))!.workItemId,
          revokedAt: new Date(),
        });
      const response = await app.request(`/web/config/models?resourceId=${SESSION_ID}&threadId=run-thread&scope=user`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.modelScope).toBe('factory');
      expect(body.defaultModelId).toBe('deepseek/deepseek-flash');
      expect(body.personalThinkingLevel).toBeNull();
      expect(body).toMatchObject({ modelPacks: [factoryPack], defaultModelPackId: 'factory-pack' });
      expect(body.models).toEqual([
        expect.objectContaining({ id: 'deepseek/deepseek-flash', credentialLabel: 'Deepseek API key' }),
      ]);
    },
  );

  it('keeps user-scoped work items on the owner catalog', async () => {
    const { app, bind } = await setupSessionModelRoutes('user');
    await bind();
    const response = await app.request(`/web/config/models?resourceId=${SESSION_ID}&threadId=run-thread`);
    const body = await response.json();
    expect(body.modelScope).toBe('user');
    expect(body.defaultModelId).toBe('anthropic/claude-opus-4-6');
    expect(body.personalThinkingLevel).toBe('high');
    expect(body).toMatchObject({ modelPacks: [ownerPack], defaultModelPackId: 'owner-pack' });
    expect(body.models.map((m: { id: string }) => m.id)).toEqual(['anthropic/claude-opus-4-6']);
  });

  it('denies collaborators on private sessions and foreign organizations', async () => {
    const privateSession = await setupSessionModelRoutes('hybrid', 'private');
    expect(
      (await privateSession.app.request(`/web/config/models?resourceId=${SESSION_ID}&threadId=chat-thread`)).status,
    ).toBe(403);
    const foreign = await setupSessionModelRoutes();
    foreign.setOrgId('other-org');
    expect((await foreign.app.request(`/web/config/models?resourceId=${SESSION_ID}&threadId=chat-thread`)).status).toBe(
      403,
    );
  });

  it('rejects incomplete or unavailable session context instead of returning the viewer catalog', async () => {
    const { app } = await setupSessionModelRoutes();
    expect((await app.request(`/web/config/models?resourceId=${SESSION_ID}`)).status).toBe(400);
    expect((await app.request('/web/config/models?threadId=chat-thread')).status).toBe(400);
    expect((await app.request('/web/config/models?resourceId=missing&threadId=chat-thread')).status).toBe(403);
  });
});
