const { appDataDir, previousEnv } = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? '/tmp'}/mastracode-model-kimi-${process.pid}`;
  const previous = {
    appDataDir: process.env.MASTRA_APP_DATA_DIR,
    kimiApiKey: process.env.KIMI_API_KEY,
    mastraGatewayApiKey: process.env.MASTRA_GATEWAY_API_KEY,
  };
  process.env.MASTRA_APP_DATA_DIR = dir;
  return { appDataDir: dir, previousEnv: previous };
});

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MastraGateway } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { setRequestAccountSelection } from '../auth/account-routing-context.js';
import type { CredentialStore } from '../auth/types.js';
import { loadSettings } from '../onboarding/settings.js';
import { setCredentialStoreProvider } from './credential-resolver.js';
import { MastraCodeGateway } from './mastracode-gateway.js';
import {
  createRequestScopedCredentialStore,
  getDynamicModel,
  resolveModel,
  resolvePackMemoryModelChain,
} from './model.js';

afterEach(() => {
  if (previousEnv.kimiApiKey === undefined) delete process.env.KIMI_API_KEY;
  else process.env.KIMI_API_KEY = previousEnv.kimiApiKey;
  if (previousEnv.mastraGatewayApiKey === undefined) delete process.env.MASTRA_GATEWAY_API_KEY;
  else process.env.MASTRA_GATEWAY_API_KEY = previousEnv.mastraGatewayApiKey;
  setCredentialStoreProvider(undefined);
  vi.restoreAllMocks();
});

afterAll(() => {
  if (previousEnv.appDataDir === undefined) delete process.env.MASTRA_APP_DATA_DIR;
  else process.env.MASTRA_APP_DATA_DIR = previousEnv.appDataDir;
  rmSync(appDataDir, { recursive: true, force: true });
});

describe('request-scoped credentials', () => {
  it('keeps concurrent request account selections independent', async () => {
    const accounts = [
      {
        type: 'oauth-account' as const,
        id: 'anthropic:a',
        label: 'Account A',
        addedAt: '2026-01-01T00:00:00.000Z',
        active: true,
        access: 'token-a',
        refresh: 'refresh-a',
        expires: Date.now() + 60_000,
      },
      {
        type: 'oauth-account' as const,
        id: 'anthropic:b',
        label: 'Account B',
        addedAt: '2026-01-01T00:00:00.000Z',
        active: false,
        access: 'token-b',
        refresh: 'refresh-b',
        expires: Date.now() + 60_000,
      },
    ];
    const base = {
      reload: vi.fn(),
      get: vi.fn(() => ({ type: 'oauth', access: 'token-a', refresh: 'refresh-a', expires: Date.now() + 60_000 })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async (_providerId: string, accountId?: string) =>
        accountId === accounts[1]!.id ? 'token-b' : 'token-a',
      ),
      getOAuthCredential: vi.fn(async (_providerId: string, accountId?: string) => ({
        type: 'oauth' as const,
        access: accountId === accounts[1]!.id ? 'token-b' : 'token-a',
        refresh: accountId === accounts[1]!.id ? 'refresh-b' : 'refresh-a',
        expires: Date.now() + 60_000,
        accountInstanceId: accountId,
      })),
      listAccounts: vi.fn(() => accounts),
    } satisfies CredentialStore;
    const requestA = new RequestContext();
    const requestB = new RequestContext();
    setRequestAccountSelection(requestA, 'anthropic', accounts[0]!.id);
    setRequestAccountSelection(requestB, 'anthropic', accounts[1]!.id);
    const scopedA = createRequestScopedCredentialStore(base, requestA);
    const scopedB = createRequestScopedCredentialStore(base, requestB);

    await expect(scopedA.getOAuthCredential?.('anthropic')).resolves.toMatchObject({ access: 'token-a' });
    await expect(scopedB.getOAuthCredential?.('anthropic')).resolves.toMatchObject({ access: 'token-b' });
    await expect(scopedA.getOAuthCredential?.('anthropic')).resolves.toMatchObject({ access: 'token-a' });
  });

  it('fails closed when a recorded selection no longer resolves to an account', () => {
    const base = {
      reload: vi.fn(),
      // The provider's active credential — the account routing passed over.
      get: vi.fn(() => ({
        type: 'oauth' as const,
        access: 'active-token',
        refresh: 'r',
        expires: Date.now() + 60_000,
      })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => 'active-token'),
      listAccounts: vi.fn(() => []),
    } satisfies CredentialStore;
    const requestContext = new RequestContext();
    // Selected, then removed before the credential read.
    setRequestAccountSelection(requestContext, 'anthropic', 'anthropic:gone');
    const scoped = createRequestScopedCredentialStore(base, requestContext);

    // Falling through to `base.get` would serve the active account, i.e. the
    // exhausted one routing just refused.
    expect(scoped.get('anthropic')).toBeUndefined();
    expect(base.get).not.toHaveBeenCalled();
  });

  it('still uses the base credential when the request has no selection', () => {
    const base = {
      reload: vi.fn(),
      get: vi.fn(() => ({
        type: 'oauth' as const,
        access: 'active-token',
        refresh: 'r',
        expires: Date.now() + 60_000,
      })),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => 'active-token'),
      listAccounts: vi.fn(() => []),
    } satisfies CredentialStore;
    const scoped = createRequestScopedCredentialStore(base, new RequestContext());

    expect(scoped.get('anthropic')).toMatchObject({ access: 'active-token' });
  });

  it('fails closed on the stored API-key slot when the request selected an account', () => {
    const base = {
      reload: vi.fn(),
      get: vi.fn(),
      getStoredApiKey: vi.fn((provider: string) => (provider === 'anthropic' ? 'sk-ant-provider-wide' : 'sk-other')),
      getApiKey: vi.fn(async () => 'active-token'),
      listAccounts: vi.fn(() => [
        {
          type: 'oauth-account' as const,
          id: 'anthropic:b',
          label: 'Account B',
          addedAt: '2026-01-01T00:00:00.000Z',
          active: false,
          access: 'token-b',
          refresh: 'refresh-b',
          expires: Date.now() + 60_000,
        },
      ]),
    } satisfies CredentialStore;
    const requestContext = new RequestContext();
    setRequestAccountSelection(requestContext, 'anthropic', 'anthropic:b');
    const scoped = createRequestScopedCredentialStore(base, requestContext);

    // The `apikey:` slot is provider-wide, not the account routing selected.
    // Serving it would be an OAuth -> API-key fallback for the same provider.
    expect(scoped.getStoredApiKey('anthropic')).toBeUndefined();
    expect(base.getStoredApiKey).not.toHaveBeenCalled();
    // An unrouted provider on the same request still reads its stored key.
    expect(scoped.getStoredApiKey('openai-codex')).toBe('sk-other');
    expect(base.getStoredApiKey).toHaveBeenCalledWith('openai-codex');
  });
});

describe('getDynamicModel error branches', () => {
  it('points at the missing controller context when the run has no session request context at all', () => {
    const requestContext = new RequestContext();
    expect(() => getDynamicModel({ requestContext })).toThrow(
      'No model available: this run started without a controller session context, so no model selection could be resolved.',
    );
  });

  it('keeps the /models guidance when a controller context exists but has no model selected', () => {
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId: '' } });
    expect(() => getDynamicModel({ requestContext })).toThrow(
      'No model selected. Use /models to select a model first.',
    );
  });
});

describe('getDynamicModel fallback chain', () => {
  function seedSettings(packFallbacks: Record<string, string>) {
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: { packFallbacks },
      }),
      'utf-8',
    );
  }

  function requestWithSession(modelId: string, modeId = 'build', activeModelPackId = modelId.split('/')[0]) {
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId, modeId },
      getState: () => ({ activeModelPackId }),
    });
    return { requestContext };
  }

  it('returns a bare model when no fallback is configured — identical to before', () => {
    seedSettings({});

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));

    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('claude-fable-5');
  });

  it('returns a bare model for a manual /model selection that matches no pack', () => {
    seedSettings({ anthropic: 'openai' });

    const model = getDynamicModel(requestWithSession('openai/gpt-5.4-mini'));

    expect(Array.isArray(model)).toBe(false);
  });

  it('does not infer another pack when a manual override happens to match its model', () => {
    seedSettings({ openai: 'github-copilot' });

    const model = getDynamicModel(requestWithSession('openai/gpt-5.6-sol', 'build', 'anthropic'));

    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('gpt-5.6-sol');
  });

  it('builds the fallback array from the active pack chain, resolving each pack for the same mode', () => {
    seedSettings({ anthropic: 'openai', openai: 'github-copilot' });

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));

    expect(Array.isArray(model)).toBe(true);
    const entries = model as Array<{ id?: string; model: { modelId?: string } }>;
    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'github-copilot']);
    expect(entries.map(entry => entry.model.modelId)).toEqual(['claude-fable-5', 'gpt-5.6-sol', 'gpt-4.1']);
  });

  it('uses the explicit active pack when another pack has the same mode model', () => {
    seedSettings({ 'custom:Shared Model': 'openai' });
    const raw = JSON.parse(readFileSync(join(appDataDir, 'settings.json'), 'utf-8'));
    // Simulate another TUI instance changing the global pack while this
    // request's thread still explicitly owns the custom pack.
    raw.models.activeModelPackId = 'anthropic';
    raw.customModelPacks = [
      {
        name: 'Shared Model',
        models: { build: 'anthropic/claude-fable-5' },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(raw), 'utf-8');

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5', 'build', 'custom:Shared Model'));
    const entries = model as Array<{ id?: string }>;

    expect(entries.map(entry => entry.id)).toEqual(['custom:Shared Model', 'openai']);
  });

  it('starts a new request on the pending landed pack before the TUI finishes persisting stickiness', () => {
    seedSettings({ anthropic: 'openai', openai: 'github-copilot' });
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => ({
        activeModelPackId: 'anthropic',
        mastracodePendingPackFallback: {
          fromPackId: 'anthropic',
          toPackId: 'openai',
          toModelId: 'openai/gpt-5.6-sol',
          threadId: 'thread-1',
        },
      }),
    });

    const model = getDynamicModel({ requestContext });
    const entries = model as Array<{ id?: string; model: { modelId?: string } }>;

    expect(entries.map(entry => entry.id)).toEqual(['openai', 'github-copilot']);
    expect(entries.map(entry => entry.model.modelId)).toEqual(['gpt-5.6-sol', 'gpt-4.1']);
  });

  it('ignores pending fallback state captured for another thread', () => {
    seedSettings({ anthropic: 'openai', openai: 'github-copilot' });
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-2',
      getState: () => ({
        activeModelPackId: 'anthropic',
        mastracodePendingPackFallback: {
          fromPackId: 'anthropic',
          toPackId: 'openai',
          toModelId: 'openai/gpt-5.6-sol',
          threadId: 'thread-1',
        },
      }),
    });

    const model = getDynamicModel({ requestContext });
    const entries = model as Array<{ id?: string }>;

    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'github-copilot']);
  });

  it('truncates the chain at a fallback pack that lacks the session mode model', () => {
    seedSettings({ anthropic: 'custom:empty' });
    const raw = JSON.parse(readFileSync(join(appDataDir, 'settings.json'), 'utf-8'));
    raw.customModelPacks = [{ name: 'empty', models: {} }];
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(raw), 'utf-8');

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));

    // The fallback pack cannot serve mode 'build', so the chain collapses to
    // the primary alone — a bare model, not a one-entry fallback array.
    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('claude-fable-5');
  });

  it('truncates the chain at a fallback entry whose model fails to resolve (deployed fail-closed)', async () => {
    seedSettings({ anthropic: 'openai' });
    // Deployed-style tenant store: anthropic connected, openai not, and no
    // environment fallback — openai model resolution throws.
    setCredentialStoreProvider(() => ({
      allowEnvironmentFallback: false,
      reload: () => {},
      get: provider => (provider === 'anthropic' ? { type: 'api_key' as const, key: 'sk-ant-tenant' } : undefined),
      getStoredApiKey: provider => (provider === 'anthropic' ? 'sk-ant-tenant' : undefined),
      getApiKey: async provider => (provider === 'anthropic' ? 'sk-ant-tenant' : undefined),
    }));
    const requestContext = new RequestContext();
    requestContext.set('user', { workosId: 'user_1', id: 'prov_1', organizationId: 'org_1' });
    requestContext.set('controller', { session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' } });

    const model = getDynamicModel({ requestContext });

    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('claude-fable-5');
  });

  it('gives a revisited pack a unique per-occurrence id (A→B→A chain)', () => {
    seedSettings({ anthropic: 'openai', openai: 'anthropic' });

    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));
    const entries = model as Array<{ id?: string }>;

    // One revisit total per cascade (Q15: full circle, one revisit, surface).
    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'anthropic#2']);
  });

  it('identifies the pack through builtin overrides applied to the session model', () => {
    seedSettings({ anthropic: 'openai' });
    const raw = JSON.parse(readFileSync(join(appDataDir, 'settings.json'), 'utf-8'));
    raw.models.modePackOverrides = { anthropic: { build: 'anthropic/claude-haiku-4-5' } };
    writeFileSync(join(appDataDir, 'settings.json'), JSON.stringify(raw), 'utf-8');

    const model = getDynamicModel(requestWithSession('anthropic/claude-haiku-4-5'));

    expect(Array.isArray(model)).toBe(true);
    expect((model as Array<{ id?: string }>).map(entry => entry.id)).toEqual(['anthropic', 'openai']);
  });
});

describe('resolvePackMemoryModelChain', () => {
  function seedOmSettings({
    packFallbacks = {},
    customModelPacks = [],
    modePackOverrides = {},
  }: {
    packFallbacks?: Record<string, string>;
    customModelPacks?: Array<{ name: string; models: Record<string, string>; createdAt?: string }>;
    modePackOverrides?: Record<string, Record<string, string>>;
  }) {
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: { packFallbacks, modePackOverrides },
        customModelPacks: customModelPacks.map(pack => ({ createdAt: '2026-01-01T00:00:00.000Z', ...pack })),
      }),
      'utf-8',
    );
    return loadSettings();
  }

  it('returns undefined when no pack in the chain defines an OM model', () => {
    const settings = seedOmSettings({ packFallbacks: { anthropic: 'openai' } });

    expect(resolvePackMemoryModelChain(settings, 'anthropic', undefined)).toBeUndefined();
  });

  it('returns undefined for an unknown start pack', () => {
    const settings = seedOmSettings({});

    expect(resolvePackMemoryModelChain(settings, 'custom:missing', undefined)).toBeUndefined();
  });

  it('returns a bare model for a single pack OM entry', () => {
    const settings = seedOmSettings({
      customModelPacks: [
        {
          name: 'Work',
          models: { build: 'anthropic/claude-fable-5', memory: 'anthropic/claude-haiku-4-5' },
        },
      ],
    });

    const model = resolvePackMemoryModelChain(settings, 'custom:Work', undefined);

    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('claude-haiku-4-5');
  });

  it('collects OM models along the fallback chain, skipping packs without one', () => {
    const settings = seedOmSettings({
      packFallbacks: { 'custom:A': 'custom:B', 'custom:B': 'custom:C' },
      customModelPacks: [
        { name: 'A', models: { build: 'anthropic/claude-fable-5', memory: 'anthropic/claude-haiku-4-5' } },
        { name: 'B', models: { build: 'openai/gpt-5.6-sol' } },
        { name: 'C', models: { build: 'openai/gpt-5.6-sol', memory: 'openai/gpt-5.4-mini' } },
      ],
    });

    const model = resolvePackMemoryModelChain(settings, 'custom:A', undefined);
    const entries = model as Array<{ id: string; model: { modelId?: string } }>;

    expect(entries.map(entry => entry.id)).toEqual(['custom:A:memory', 'custom:C:memory']);
    expect(entries.map(entry => entry.model.modelId)).toEqual(['claude-haiku-4-5', 'gpt-5.4-mini']);
  });

  it('collapses duplicate OM models so a cycle never retries an identical model', () => {
    const settings = seedOmSettings({
      packFallbacks: { 'custom:A': 'custom:B', 'custom:B': 'custom:A' },
      customModelPacks: [
        { name: 'A', models: { build: 'anthropic/claude-fable-5', memory: 'anthropic/claude-haiku-4-5' } },
        { name: 'B', models: { build: 'openai/gpt-5.6-sol', memory: 'anthropic/claude-haiku-4-5' } },
      ],
    });

    const model = resolvePackMemoryModelChain(settings, 'custom:A', undefined);

    expect(Array.isArray(model)).toBe(false);
    expect((model as { modelId?: string }).modelId).toBe('claude-haiku-4-5');
  });

  it('reads a builtin pack OM model from modePackOverrides', () => {
    const settings = seedOmSettings({
      packFallbacks: { anthropic: 'openai' },
      modePackOverrides: {
        anthropic: { memory: 'anthropic/claude-haiku-4-5' },
        openai: { memory: 'openai/gpt-5.4-mini' },
      },
    });

    const model = resolvePackMemoryModelChain(settings, 'anthropic', undefined);
    const entries = model as Array<{ id: string; model: { modelId?: string } }>;

    expect(entries.map(entry => entry.id)).toEqual(['anthropic:memory', 'openai:memory']);
    expect(entries.map(entry => entry.model.modelId)).toEqual(['claude-haiku-4-5', 'gpt-5.4-mini']);
  });
});

describe('resolveModel Kimi For Coding authentication', () => {
  it('delegates an explicit Mastra Gateway model without selecting the direct Kimi transport', () => {
    process.env.MASTRA_GATEWAY_API_KEY = 'msk-gateway-key';
    const delegatedModel = { provider: 'mastra-gateway' };
    const gatewaySpy = vi
      .spyOn(MastraGateway.prototype, 'resolveLanguageModel')
      .mockReturnValue(delegatedModel as ReturnType<MastraGateway['resolveLanguageModel']>);

    const model = resolveModel('mastra/kimi-for-coding/k3');

    expect(model).toBe(delegatedModel);
    expect(gatewaySpy).toHaveBeenCalledWith({
      providerId: 'kimi-for-coding',
      modelId: 'k3',
      apiKey: 'msk-gateway-key',
      headers: undefined,
    });
  });

  it('passes KIMI_API_KEY into direct Kimi model resolution', () => {
    process.env.KIMI_API_KEY = 'kimi-env-key';
    const resolveSpy = vi.spyOn(MastraCodeGateway.prototype, 'resolveLanguageModel');

    resolveModel('kimi-for-coding/k3');

    expect(resolveSpy).toHaveBeenCalledWith({
      providerId: 'kimi-for-coding',
      modelId: 'k3',
      apiKey: 'kimi-env-key',
      headers: undefined,
    });
  });
});
