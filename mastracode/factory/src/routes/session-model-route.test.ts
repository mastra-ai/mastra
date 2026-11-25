import { describe, expect, it } from 'vitest';

import type { ModelCatalog } from './config.js';
import { SESSION_ID, setupSessionModelRoutes, viewerPack } from './__tests__/session-model-test-fixture.js';
import type { SessionModelApp } from './__tests__/session-model-test-fixture.js';

function liveSession({ threadId = 'chat-thread', failSwitch = false } = {}) {
  const settings = new Map<string, unknown>();
  const events: unknown[] = [];
  const session = {
    model: {
      get: () => '',
      switch: async (modelId: string, options?: { thinkingLevel?: string }) => {
        if (failSwitch) throw new Error('no credential for that model');
        events.push({ switched: modelId, thinkingLevel: options?.thinkingLevel });
      },
    },
    thread: {
      getId: () => threadId,
      getById: async (input: { threadId: string }) =>
        input.threadId === threadId ? { metadata: Object.fromEntries(settings) } : null,
      setSettingOn: async ({ key, value }: { threadId: string; key: string; value: unknown }) => {
        settings.set(key, value);
        events.push({ setting: key, value });
      },
    },
  };
  const getSession: NonNullable<ModelCatalog['getSession']> = async sessionId =>
    sessionId === SESSION_ID ? session : undefined;
  return { settings, events, getSession };
}

const putSelection = (app: SessionModelApp, selection: unknown, address: Record<string, string> = {}) =>
  app.request('/web/config/session-model', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resourceId: SESSION_ID, threadId: 'chat-thread', ...address, selection }),
  });

const catalogSelection = async (app: SessionModelApp) =>
  (await (await app.request(`/web/config/models?resourceId=${SESSION_ID}&threadId=chat-thread`)).json()).modelSelection;

describe('PUT /web/config/session-model', () => {
  it("runs a live session on one of its owner's packs and reports that pack in the catalog", async () => {
    const live = liveSession();
    const { app } = await setupSessionModelRoutes('user', 'org', live.getSession);

    for (const notTheOwners of ['missing', viewerPack.id]) {
      const rejected = await putSelection(app, { kind: 'pack', packId: notTheOwners });
      expect(rejected.status).toBe(404);
      expect(await rejected.json()).toEqual({ error: 'model_pack_not_found' });
    }
    expect(live.events).toEqual([]);

    const chosen = await putSelection(app, { kind: 'pack', packId: 'owner-pack' });
    expect(chosen.status).toBe(200);
    expect(await chosen.json()).toEqual({ modelSelection: { kind: 'pack', packId: 'owner-pack' } });
    expect(live.events).toEqual([
      { setting: 'factoryModelSelection', value: { kind: 'pack', packId: 'owner-pack' } },
      { switched: 'anthropic/claude-opus-4-6', thinkingLevel: 'high' },
    ]);
    expect(await catalogSelection(app)).toEqual({ kind: 'pack', packId: 'owner-pack' });
  });

  it('follows the default pack for the default selection', async () => {
    const live = liveSession();
    const { app } = await setupSessionModelRoutes('user', 'org', live.getSession);

    const chosen = await putSelection(app, { kind: 'default' });
    expect(await chosen.json()).toEqual({ modelSelection: { kind: 'pack', packId: 'owner-pack' } });
    expect(live.settings.get('factoryModelSelection')).toEqual({ kind: 'default' });
    expect(live.events.at(-1)).toEqual({ switched: 'anthropic/claude-opus-4-6', thinkingLevel: 'high' });
  });

  it("runs an exact model even when it is the default pack's first model", async () => {
    const live = liveSession();
    const { app } = await setupSessionModelRoutes('user', 'org', live.getSession);

    const chosen = await putSelection(app, {
      kind: 'model',
      modelId: 'anthropic/claude-opus-4-6',
      thinkingLevel: 'low',
    });
    expect(await chosen.json()).toEqual({ modelSelection: { kind: 'model' } });
    expect(live.events).toEqual([
      { setting: 'factoryModelSelection', value: { kind: 'model' } },
      { switched: 'anthropic/claude-opus-4-6', thinkingLevel: 'low' },
    ]);
    expect(await catalogSelection(app)).toEqual({ kind: 'model' });
  });

  it('restores the previous selection when the model switch fails', async () => {
    const live = liveSession({ failSwitch: true });
    live.settings.set('factoryModelSelection', { kind: 'model' });
    const { app } = await setupSessionModelRoutes('user', 'org', live.getSession);

    const failed = await putSelection(app, { kind: 'pack', packId: 'owner-pack' });
    expect(failed.status).toBe(500);
    expect(live.settings.get('factoryModelSelection')).toEqual({ kind: 'model' });
  });

  it('refuses a session that is not running or runs another thread', async () => {
    const { app } = await setupSessionModelRoutes('user');
    const notRunning = await putSelection(app, { kind: 'default' });
    expect(notRunning.status).toBe(409);
    expect(await notRunning.json()).toEqual({ error: 'session_not_running' });

    const live = liveSession({ threadId: 'other-thread' });
    const mismatched = await setupSessionModelRoutes('user', 'org', live.getSession);
    const response = await putSelection(mismatched.app, { kind: 'default' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'session_thread_mismatch' });
    expect(live.events).toEqual([]);
  });

  it('uses the pack set the run uses when auth is disabled', async () => {
    const live = liveSession();
    const { app } = await setupSessionModelRoutes('user', 'org', live.getSession, false);

    const catalog = await app.request(`/web/config/models?resourceId=${SESSION_ID}&threadId=chat-thread`);
    expect(await catalog.json()).toMatchObject({
      defaultModelPackId: 'factory-pack',
      modelSelection: { kind: 'model' },
    });

    const chosen = await putSelection(app, { kind: 'pack', packId: 'factory-pack' });
    expect(chosen.status).toBe(200);
    expect(await chosen.json()).toEqual({ modelSelection: { kind: 'pack', packId: 'factory-pack' } });
    expect(live.events.at(-1)).toEqual({ switched: 'deepseek/deepseek-flash', thinkingLevel: 'medium' });
  });
});
