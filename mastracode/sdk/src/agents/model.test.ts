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

import { rmSync } from 'node:fs';
import { MastraGateway } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { setRequestAccountSelection } from '../auth/account-routing-context.js';
import type { CredentialStore } from '../auth/types.js';
import { MODEL_ROUTE_MAX_ENTRIES } from '../constants.js';
import { loadSettings } from '../onboarding/settings.js';
import { setCredentialStoreProvider } from './credential-resolver.js';
import { MastraCodeGateway } from './mastracode-gateway.js';
import {
  createRequestScopedCredentialStore,
  getActiveRouteMemoryModelId,
  getDynamicModel,
  resolveModel,
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

  it('passes the selected account through to getApiKey so the provider slot cannot answer for it', async () => {
    const base = {
      reload: vi.fn(),
      get: vi.fn(),
      getStoredApiKey: vi.fn(),
      getApiKey: vi.fn(async () => 'selected-token'),
    } satisfies CredentialStore;
    const requestContext = new RequestContext();
    setRequestAccountSelection(requestContext, 'anthropic', 'anthropic:b');
    const scoped = createRequestScopedCredentialStore(base, requestContext);

    await expect(scoped.getApiKey('anthropic')).resolves.toBe('selected-token');
    // The selection has to reach the store: with no account argument a provider
    // slot holding an API key answers the call instead of the routed account.
    expect(base.getApiKey).toHaveBeenCalledWith('anthropic', 'anthropic:b');
    // An unrouted provider on the same request is not narrowed.
    await scoped.getApiKey('openai-codex');
    expect(base.getApiKey).toHaveBeenCalledWith('openai-codex', undefined);
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

describe('getDynamicModel model route', () => {
  const route = [
    { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' },
    { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol' },
    { id: 'github-copilot', label: 'GitHub Copilot', modelId: 'github-copilot/gpt-4.1' },
  ];

  function requestWithSession(
    modelId: string,
    options?: {
      threadId?: string;
      route?: typeof route;
      pending?: {
        fromEntryId: string;
        toEntryId: string;
        toModelId: string;
        threadId?: string;
        reason: 'pool-exhausted' | 'persistent-outage';
        at: string;
      };
    },
  ) {
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId, modeId: 'build' },
      threadId: options?.threadId,
      getState: () => ({
        modelRoute: options?.route ? { entries: options.route } : undefined,
        mastracodePendingModelFallback: options?.pending,
      }),
    });
    return { requestContext };
  }

  it('returns a bare model when no route is configured', () => {
    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5'));

    expect(Array.isArray(model)).toBe(false);
    expect((model as { model: { modelId?: string } }).model.modelId).toBe('claude-fable-5');
    expect((model as { id: string }).id).toBe('anthropic/claude-fable-5');
  });

  it('labels a custom-provider model with its provider/model ID', () => {
    const model = getDynamicModel(requestWithSession('mastracode/anthropic/claude-fable-5'));

    expect((model as { id: string }).id).toBe('anthropic/claude-fable-5');
  });

  it('returns a bare model when the route does not start with the selected model', () => {
    const model = getDynamicModel(requestWithSession('openai/gpt-5.4-mini', { route }));

    expect(Array.isArray(model)).toBe(false);
    expect((model as { model: { modelId?: string } }).model.modelId).toBe('gpt-5.4-mini');
  });

  it('builds a fallback array from the host-supplied route', () => {
    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5', { route }));
    const entries = model as Array<{ id?: string; model: { model: { modelId?: string } } }>;

    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'github-copilot']);
    expect(entries.map(entry => entry.model.model.modelId)).toEqual(['claude-fable-5', 'gpt-5.6-sol', 'gpt-4.1']);
    expect(entries.map(entry => (entry.model as unknown as { id: string }).id)).toEqual([
      'anthropic/claude-fable-5',
      'openai/gpt-5.6-sol',
      'github-copilot/gpt-4.1',
    ]);
  });

  it('starts at a same-thread pending route hop', () => {
    const model = getDynamicModel(
      requestWithSession('anthropic/claude-fable-5', {
        threadId: 'thread-1',
        route,
        pending: {
          fromEntryId: 'anthropic',
          toEntryId: 'openai',
          toModelId: 'openai/gpt-5.6-sol',
          threadId: 'thread-1',
          reason: 'pool-exhausted',
          at: '2026-10-05T00:00:00.000Z',
        },
      }),
    );
    const entries = model as Array<{ id?: string; model: { model: { modelId?: string } } }>;

    expect(entries.map(entry => entry.id)).toEqual(['openai', 'github-copilot']);
    expect(entries.map(entry => entry.model.model.modelId)).toEqual(['gpt-5.6-sol', 'gpt-4.1']);
  });

  it('ignores pending fallback state captured for another thread', () => {
    const model = getDynamicModel(
      requestWithSession('anthropic/claude-fable-5', {
        threadId: 'thread-2',
        route,
        pending: {
          fromEntryId: 'anthropic',
          toEntryId: 'openai',
          toModelId: 'openai/gpt-5.6-sol',
          threadId: 'thread-1',
          reason: 'pool-exhausted',
          at: '2026-10-05T00:00:00.000Z',
        },
      }),
    );
    const entries = model as Array<{ id?: string }>;

    expect(entries.map(entry => entry.id)).toEqual(['anthropic', 'openai', 'github-copilot']);
  });

  it('returns the pending model as a bare model when the pending entry is absent from the route', () => {
    const model = getDynamicModel(
      requestWithSession('anthropic/claude-fable-5', {
        threadId: 'thread-1',
        route,
        pending: {
          fromEntryId: 'anthropic',
          toEntryId: 'removed',
          toModelId: 'openai/gpt-5.4-mini',
          threadId: 'thread-1',
          reason: 'pool-exhausted',
          at: '2026-10-05T00:00:00.000Z',
        },
      }),
    );

    expect(Array.isArray(model)).toBe(false);
    expect((model as { model: { modelId?: string } }).model.modelId).toBe('gpt-5.4-mini');
  });

  it('caps route resolution for persisted state that bypassed schema validation', () => {
    const oversizedRoute = Array.from({ length: MODEL_ROUTE_MAX_ENTRIES + 1 }, (_, index) => ({
      id: `route-${index}`,
      label: `Route ${index}`,
      modelId: 'anthropic/claude-fable-5',
    }));
    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5', { route: oversizedRoute }));

    expect((model as Array<{ id?: string }>).map(entry => entry.id)).toHaveLength(MODEL_ROUTE_MAX_ENTRIES);
    expect((model as Array<{ id?: string }>).at(-1)?.id).toBe(`route-${MODEL_ROUTE_MAX_ENTRIES - 1}`);
  });

  it('truncates the route at an entry whose model cannot resolve', () => {
    const model = getDynamicModel(
      requestWithSession('anthropic/claude-fable-5', {
        route: [route[0]!, { id: 'invalid', label: 'Invalid', modelId: 'not-a-model-id' }, route[1]!],
      }),
    );

    expect(Array.isArray(model)).toBe(false);
    expect((model as { model: { modelId?: string } }).model.modelId).toBe('claude-fable-5');
  });

  it('gives a revisited entry id a unique occurrence suffix', () => {
    const repeatedRoute = [route[0]!, route[1]!, { ...route[0]! }];
    const model = getDynamicModel(requestWithSession('anthropic/claude-fable-5', { route: repeatedRoute }));

    expect((model as Array<{ id?: string }>).map(entry => entry.id)).toEqual(['anthropic', 'openai', 'anthropic#2']);
  });
});

describe('getActiveRouteMemoryModelId', () => {
  const entries = [
    { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' },
    { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol', memoryModelId: 'openai/gpt-5.4-mini' },
  ];

  it('returns undefined when the route sets no memory model', () => {
    expect(getActiveRouteMemoryModelId({ modelRoute: { entries: [entries[0]] } })).toBeUndefined();
  });

  it('returns Auto only when the first route entry sets memory to Auto', () => {
    expect(
      getActiveRouteMemoryModelId({ modelRoute: { entries: [{ ...entries[0], memoryModelId: 'auto' }, entries[1]] } }),
    ).toBe('auto');
    expect(getActiveRouteMemoryModelId({ modelRoute: { entries } })).toBe('openai/gpt-5.4-mini');
  });

  it('honors a pending fallback hop only for its own thread', () => {
    const state = {
      modelRoute: {
        entries: [{ ...entries[0], memoryModelId: 'anthropic/claude-haiku-4-5' }, entries[1]],
      },
      mastracodePendingModelFallback: { toEntryId: 'openai', threadId: 'thread-1' },
    };
    expect(getActiveRouteMemoryModelId(state, 'thread-1')).toBe('openai/gpt-5.4-mini');
    expect(getActiveRouteMemoryModelId(state, 'thread-2')).toBe('anthropic/claude-haiku-4-5');
  });
});
