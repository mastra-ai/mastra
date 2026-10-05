import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { buildProviderAccess } from '@mastra/factory/routes/config';
import {
  hydrateSessionDefaultModel,
  type DefaultModelHydrationSession,
} from '@mastra/factory/session/default-model-hydration';
import { ModelDefaultsStorage } from '@mastra/factory/storage/domains/model-defaults/base';
import { LibSQLFactoryStorage } from '@mastra/libsql';

/**
 * The web host derives its model catalog from the controller and seeds new
 * interactive sessions from the Factory user's persisted personal default.
 */
describe('web default model', () => {
  const catalog = (models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[]) => ({
    listAvailableModels: async () => models,
  });

  let auth: AuthStorage;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'mc-default-model-'));
    auth = new AuthStorage(join(tmpDir, 'auth.json'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('derives provider access — a usable key on any provider grants apikey access', async () => {
    const access = await buildProviderAccess({
      controller: catalog([
        { provider: 'anthropic', hasApiKey: true },
        { provider: 'cohere', hasApiKey: true },
        { provider: 'unreachable', hasApiKey: false },
      ]),
      authStorage: auth,
    });

    expect(access.cohere).toBe('apikey');
    expect(access.unreachable).toBeFalsy();
  });

  it('hydrates the current model and every subagent from the personal default', async () => {
    const storage = new LibSQLFactoryStorage({ id: 'web-default-model-scenario', url: ':memory:' });
    const modelDefaults = storage.registerDomain(new ModelDefaultsStorage());
    await storage.init();

    try {
      const modelId = 'openai/gpt-5.4-mini';
      await modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId });

      const persistedSettings = new Map<string, unknown>();
      const switchModel = vi.fn(async ({ modelId: nextModelId }: { modelId: string }) => {
        persistedSettings.set('currentModelId', nextModelId);
      });
      const setSubagentModel = vi.fn(async () => undefined);
      const session = {
        identity: { getResourceId: () => 'session-1' },
        state: { get: () => ({}) },
        thread: {
          getId: () => 'thread-1',
          getSetting: vi.fn(async ({ key }: { key: string }) => persistedSettings.get(key)),
        },
        model: { switch: switchModel },
        subagents: { model: { set: setSubagentModel } },
      } satisfies DefaultModelHydrationSession;

      await hydrateSessionDefaultModel(session, {
        sourceControl: {
          sessions: {
            getBySessionId: vi.fn(async () => ({ orgId: 'org-1', userId: 'user-1' }) as never),
          },
        },
        workItems: {
          findActiveRunBindingByThread: vi.fn(async () => null),
        },
        modelDefaults,
      });

      expect(switchModel).toHaveBeenCalledExactlyOnceWith({ modelId });
      expect(persistedSettings.get('currentModelId')).toBe(modelId);
      expect([...persistedSettings.keys()].filter(key => key.startsWith('modeModelId_'))).toEqual([]);
      expect(setSubagentModel.mock.calls).toEqual([
        [{ modelId, agentType: 'explore' }],
        [{ modelId, agentType: 'plan' }],
        [{ modelId, agentType: 'execute' }],
      ]);
    } finally {
      await storage.close();
    }
  });
});
