/**
 * Unit tests for the account-rotation error processor.
 *
 * Drive `processAPIError` / `processInput` directly with fabricated
 * `APICallError`-shaped errors against a real AuthStorage seeded with two
 * Anthropic accounts, following the storage.test.ts isolation precedent
 * (isolated MASTRA_APP_DATA_DIR + explicit temp auth.json path).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TripWire } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Isolate the app data dir before any import that could read it.
vi.hoisted(() => {
  process.env.MASTRA_APP_DATA_DIR = `${process.env.TMPDIR ?? '/tmp'}/mastracode-account-rotation-${process.pid}-${Date.now()}`;
  process.env.MASTRA_TELEMETRY_DISABLED = '1';
});

import { setCredentialStoreProvider } from '../agents/credential-resolver.js';
import { createRequestScopedCredentialStore } from '../agents/model.js';
import { THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY } from '../onboarding/settings.js';
import {
  ACCOUNT_SWITCH_PART_TYPE,
  PACK_FALLBACK_PART_TYPE,
  PACK_FALLBACK_STATE_KEY,
  AccountRotationProcessor,
  AccountStartNoticeProcessor,
  classifyRotationError,
  clearExhaustedAccountRoute,
  isAccountSwitchReason,
  providerFromError,
  providerFromModelId,
} from './account-rotation-processor.js';
import {
  getRequestAccountSelection,
  isRequestAccountRoutingExhausted,
  markRequestAccountRoutingExhausted,
  setRequestAccountSelection,
} from './account-routing-context.js';
import { ProviderAuthRequiredError } from './provider-auth-error.js';
import { anthropicOAuthProvider } from './providers/anthropic.js';
import { AuthStorage } from './storage.js';
import type { CredentialStore } from './types.js';

const PROVIDER = 'anthropic';
const FUTURE = Date.now() + 60 * 60 * 1000;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

interface FabricatedAPIError extends Error {
  statusCode?: number;
  url?: string;
  modelId?: string;
}

function apiError(
  statusCode: number,
  opts: { url?: string | null; message?: string; modelId?: string } = {},
): FabricatedAPIError {
  const error = new Error(opts.message ?? `API error ${statusCode}`) as FabricatedAPIError;
  error.statusCode = statusCode;
  // Defaults to the Anthropic URL; pass `null` to omit (modelId-only cases).
  const url = opts.url === undefined ? ANTHROPIC_URL : opts.url;
  if (url !== null) error.url = url;
  if (opts.modelId !== undefined) error.modelId = opts.modelId;
  return error;
}

const tempDirs: string[] = [];

interface SeededStorage {
  storage: AuthStorage;
  authPath: string;
  accountA: { id: string; label: string };
  accountB: { id: string; label: string };
}

/** Two-account Anthropic registry, account A active, both tokens far-future. */
async function makeTwoAccountStorage(): Promise<SeededStorage> {
  const dir = mkdtempSync(join(tmpdir(), 'account-rotation-test-'));
  tempDirs.push(dir);
  const authPath = join(dir, 'auth.json');
  const storage = new AuthStorage(authPath);
  await storage.addAccount(
    PROVIDER,
    { access: 'token-a', refresh: 'refresh-a', expires: FUTURE },
    { label: 'Account A' },
  );
  await storage.addAccount(
    PROVIDER,
    { access: 'token-b', refresh: 'refresh-b', expires: FUTURE },
    { label: 'Account B' },
  );
  storage.activateAccount(PROVIDER, storage.listAccounts(PROVIDER)[0]!.id);
  const [a, b] = storage.listAccounts(PROVIDER);
  return { storage, authPath, accountA: { id: a.id, label: a.label }, accountB: { id: b.id, label: b.label } };
}

async function addThirdAccount(storage: AuthStorage) {
  await storage.addAccount(
    PROVIDER,
    { access: 'token-c', refresh: 'refresh-c', expires: FUTURE },
    { label: 'Account C' },
  );
  const account = storage.listAccounts(PROVIDER)[2]!;
  return { id: account.id, label: account.label };
}

function readAuthJson(authPath: string): Record<string, any> {
  return JSON.parse(readFileSync(authPath, 'utf-8'));
}

function makeArgs(overrides: Partial<Record<string, any>> = {}) {
  const order: string[] = [];
  return {
    error: undefined as unknown,
    state: {} as Record<string, unknown>,
    retryCount: 0,
    stepNumber: 0,
    steps: [],
    writer: {
      custom: vi.fn(async () => {
        order.push('part');
      }),
    },
    rotateResponseMessageId: vi.fn(() => {
      order.push('rotate');
      return 'next-message-id';
    }),
    order,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('classifyRotationError (locked Q7 taxonomy)', () => {
  it('rejects prototype-chain names as account-switch reasons', () => {
    expect(isAccountSwitchReason('toString')).toBe(false);
    expect(isAccountSwitchReason('constructor')).toBe(false);
    expect(isAccountSwitchReason('pool-exhausted')).toBe(true);
  });

  it('rotates immediately on 429 and 402', () => {
    expect(classifyRotationError(apiError(429))).toEqual({ kind: 'rotate', reason: 'rate-limit' });
    expect(classifyRotationError(apiError(402))).toEqual({ kind: 'rotate', reason: 'quota-exhausted' });
  });

  it('rotates on provider usage-limit wording co-occurring with 400 or no status', () => {
    expect(
      classifyRotationError(apiError(400, { message: 'You have exceeded your usage limit for Claude Max' })),
    ).toEqual({ kind: 'rotate', reason: 'quota-exhausted' });
    expect(
      classifyRotationError(apiError(400, { message: 'Your weekly limit has been reached, try again later' })),
    ).toEqual({ kind: 'rotate', reason: 'quota-exhausted' });
    expect(classifyRotationError(new Error('You have exceeded your usage limit for Claude Max'))).toEqual({
      kind: 'rotate',
      reason: 'quota-exhausted',
    });
  });

  it('never rotates on quota wording riding a non-quota status or generic limit text', () => {
    expect(
      classifyRotationError(apiError(404, { message: 'You have exceeded your usage limit for Claude Max' })),
    ).toEqual({ kind: 'never' });
    expect(classifyRotationError(apiError(422, { message: 'request exceeds your payload limit' }))).toEqual({
      kind: 'never',
    });
    expect(classifyRotationError(apiError(400, { message: 'You exceeded your request size limit' }))).toEqual({
      kind: 'never',
    });
  });

  it.each([
    'insufficient_quota',
    'You exceeded your current quota',
    'Insufficient balance to complete this request',
    'API credits exhausted',
  ])('rotates on common 400 quota wording: %s', message => {
    expect(classifyRotationError(apiError(400, { message }))).toEqual({
      kind: 'rotate',
      reason: 'quota-exhausted',
    });
  });

  it('classifies 401/403 as auth (refresh first, then rotate)', () => {
    expect(classifyRotationError(apiError(401))).toEqual({ kind: 'rotate', reason: 'auth-failed' });
    expect(classifyRotationError(apiError(403))).toEqual({ kind: 'rotate', reason: 'auth-failed' });
  });

  it('hops on 5xx and network errors, never on 400/unknown', () => {
    expect(classifyRotationError(apiError(500))).toEqual({ kind: 'hop' });
    expect(classifyRotationError(apiError(503))).toEqual({ kind: 'hop' });
    const networkError = new Error('fetch failed') as Error & { cause?: unknown };
    networkError.cause = new Error('connect ECONNREFUSED 127.0.0.1:443');
    expect(classifyRotationError(networkError)).toEqual({ kind: 'hop' });
    expect(classifyRotationError(apiError(400))).toEqual({ kind: 'never' });
    expect(classifyRotationError(new Error('something odd'))).toEqual({ kind: 'never' });
  });

  it.each([
    [429, { kind: 'rotate', reason: 'rate-limit' }],
    [401, { kind: 'rotate', reason: 'auth-failed' }],
    [503, { kind: 'hop' }],
  ] as const)('classifies HTTP %d from a nested provider error', (statusCode, expected) => {
    const wrapper = new Error('provider request failed', { cause: apiError(statusCode) });
    expect(classifyRotationError(wrapper)).toEqual(expected);
  });

  it('classifies a nested ProviderAuthRequiredError', () => {
    const wrapper = new Error('provider request failed', { cause: new ProviderAuthRequiredError('Login required') });
    expect(classifyRotationError(wrapper)).toEqual({ kind: 'rotate', reason: 'auth-failed' });
  });
});

describe('provider attribution', () => {
  it('maps built-in OpenAI model ids to the Codex OAuth provider', () => {
    expect(providerFromModelId('openai/gpt-5.6-sol')).toBe('openai-codex');
    expect(providerFromModelId('mastracode/openai/gpt-5.6-sol')).toBe('openai-codex');
  });

  it('reads rewritten requestUrl fields and rejects lookalike hosts', () => {
    expect(providerFromError({ requestUrl: 'https://api.individual.githubcopilot.com/chat/completions' })).toBe(
      'github-copilot',
    );
    expect(
      providerFromError({ requestUrl: 'https://api.githubcopilot.com.evil.example/chat/completions' }),
    ).toBeUndefined();
    expect(providerFromError({ requestUrl: 'https://evilchatgpt.com/backend-api/codex/responses' })).toBeUndefined();
  });

  it('checks all URL fields before falling back to model metadata', () => {
    expect(
      providerFromError({
        url: 'not a URL',
        requestUrl: 'https://api.anthropic.com/v1/messages',
        modelId: 'openai/gpt-5.6-sol',
      }),
    ).toBe('anthropic');
  });

  it('prefers a nested request URL over an outer session model id', () => {
    expect(
      providerFromError({
        modelId: 'openai/gpt-5.6-sol',
        cause: { requestURL: 'https://api.anthropic.com/v1/messages' },
      }),
    ).toBe('anthropic');
  });
});

describe('AccountRotationProcessor.processAPIError', () => {
  it.each([429, 402])(
    'rotates to the next account on %d, persists the switch part, swaps the slot',
    async statusCode => {
      const seeded = await makeTwoAccountStorage();
      const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
      const args = makeArgs({ error: apiError(statusCode) });

      const result = await processor.processAPIError(args as any);

      expect(result).toEqual({ retry: true });
      // Slot now holds account B's tokens; registry marks B active.
      const onDisk = readAuthJson(seeded.authPath);
      expect(onDisk[PROVIDER]).toMatchObject({ type: 'oauth', access: 'token-b', refresh: 'refresh-b' });
      expect(onDisk[`accounts:${seeded.accountB.id}`]).toMatchObject({ active: true });
      expect(onDisk[`accounts:${seeded.accountA.id}`]).toMatchObject({ active: false });
      // Part carries labels/ids only, never token material.
      expect(args.writer.custom).toHaveBeenCalledTimes(1);
      const part = args.writer.custom.mock.calls[0][0];
      expect(part.type).toBe('data-mastracode-account-switch');
      expect(part.data).toMatchObject({
        provider: PROVIDER,
        from: { id: seeded.accountA.id, label: 'Account A' },
        to: { id: seeded.accountB.id, label: 'Account B' },
        reason: statusCode === 429 ? 'rate-limit' : 'quota-exhausted',
      });
      expect(typeof part.data.at).toBe('string');
      const serialized = JSON.stringify(part);
      expect(serialized).not.toContain('token-a');
      expect(serialized).not.toContain('token-b');
      expect(serialized).not.toContain('refresh-a');
      expect(serialized).not.toContain('refresh-b');
      // rotateResponseMessageId runs before the part is emitted.
      expect(args.order).toEqual(['rotate', 'part']);
    },
  );

  it('rotates on a usage-limit message error', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({
      error: apiError(400, { message: 'Usage limit reached for your Claude Max plan' }),
    });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });
    expect(args.writer.custom.mock.calls[0][0].data.reason).toBe('quota-exhausted');
  });

  it('retries the same account when a forced refresh succeeds on 401 (no part, no cursor move)', async () => {
    const seeded = await makeTwoAccountStorage();
    const refreshToken = vi
      .spyOn(anthropicOAuthProvider, 'refreshToken')
      .mockResolvedValue({ access: 'token-a-fresh', refresh: 'refresh-a-fresh', expires: FUTURE });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(401) });

    const result = await processor.processAPIError(args as any);

    expect(result).toEqual({ retry: true });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(args.writer.custom).not.toHaveBeenCalled();
    // Same account still active, now with the refreshed tokens.
    const onDisk = readAuthJson(seeded.authPath);
    expect(onDisk[PROVIDER]).toMatchObject({ access: 'token-a-fresh' });
    expect(onDisk[`accounts:${seeded.accountA.id}`]).toMatchObject({ active: true, access: 'token-a-fresh' });
  });

  it('rotates on 401 when the forced refresh also fails', async () => {
    const seeded = await makeTwoAccountStorage();
    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockRejectedValue(new Error('refresh rejected'));
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(401) });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });
    expect(args.writer.custom.mock.calls[0][0].data).toMatchObject({
      reason: 'auth-failed',
      to: { id: seeded.accountB.id },
    });
  });

  it('identifies the provider from the controller session for wrapper-thrown auth errors (no url/modelId)', async () => {
    // ProviderAuthRequiredError is thrown by the fetch wrappers before any
    // HTTP request exists — no url, no modelId. The session modelId is the
    // only provider signal; without it this error could never rotate.
    const seeded = await makeTwoAccountStorage();
    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockRejectedValue(new Error('refresh rejected'));
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const requestContext = {
      get: (key: string) => (key === 'controller' ? { session: { modelId: 'anthropic/claude-fable-5' } } : undefined),
    };
    const args = makeArgs({
      error: new ProviderAuthRequiredError('Not logged in to Anthropic.'),
      requestContext,
    });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });
    expect(args.writer.custom.mock.calls[0][0].data).toMatchObject({ reason: 'auth-failed' });

    // Without any provider signal the same error is a no-op.
    const seeded2 = await makeTwoAccountStorage();
    const processor2 = new AccountRotationProcessor({ credentialStore: seeded2.storage, maxProcessorRetries: 22 });
    const bare = makeArgs({ error: new ProviderAuthRequiredError('Not logged in to Anthropic.') });
    expect(await processor2.processAPIError(bare as any)).toEqual({ retry: false });
    expect(readAuthJson(seeded2.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
  });

  it('surfaces wrapper-thrown auth errors without a forced refresh when the registry has no accounts', async () => {
    // `ProviderAuthRequiredError` from an empty registry (never logged in, or
    // removed accounts): there is no token to refresh and no sibling to rotate
    // to, so the original "not logged in" error must surface — not a generic
    // pool-exhaustion message or a doomed refresh attempt.
    const dir = mkdtempSync(join(tmpdir(), 'account-rotation-test-'));
    tempDirs.push(dir);
    const storage = new AuthStorage(join(dir, 'auth.json'));
    const forceRefresh = vi.spyOn(storage, 'forceRefreshActiveAccount');
    const processor = new AccountRotationProcessor({ credentialStore: storage, maxProcessorRetries: 22 });
    const requestContext = {
      get: (key: string) => (key === 'controller' ? { session: { modelId: 'anthropic/claude-fable-5' } } : undefined),
    };
    const args = makeArgs({
      error: new ProviderAuthRequiredError('Not logged in to Anthropic.'),
      requestContext,
    });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: false });
    expect(forceRefresh).not.toHaveBeenCalled();
    expect(args.writer.custom).not.toHaveBeenCalled();
  });

  it('does not rotate or emit a part once the shared retry budget is spent', async () => {
    // Core discards retry:true when processorRetryCount >= maxProcessorRetries
    // (llm-execution-step canRetryError); rotating anyway would record a
    // switch that never happens.
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(429), retryCount: 22 });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: false });
    expect(args.writer.custom).not.toHaveBeenCalled();
    expect(args.rotateResponseMessageId).not.toHaveBeenCalled();
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
  });

  it('forces the 401 refresh once per account in a request', async () => {
    const seeded = await makeTwoAccountStorage();
    const refreshToken = vi
      .spyOn(anthropicOAuthProvider, 'refreshToken')
      .mockResolvedValueOnce({ access: 'token-a-fresh', refresh: 'refresh-a-fresh', expires: FUTURE })
      .mockResolvedValueOnce({ access: 'token-b-fresh', refresh: 'refresh-b-fresh', expires: FUTURE });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(401) });

    // Account A refreshes once, then a second 401 rotates to B.
    await processor.processAPIError(args as any);
    await processor.processAPIError(makeArgs({ error: apiError(401), state: args.state }) as any);
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });

    // Account B gets its own one-time forced refresh rather than inheriting A's budget.
    const third = await processor.processAPIError(makeArgs({ error: apiError(401), state: args.state }) as any);
    expect(third).toEqual({ retry: true });
    expect(refreshToken).toHaveBeenCalledTimes(2);
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b-fresh' });
  });

  it('declares the pool exhausted when every account has been tried', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const state: Record<string, unknown> = {};

    // First failure rotates A → B.
    await processor.processAPIError(makeArgs({ error: apiError(429), state }) as any);
    // Second failure on B: tried set is full.
    const args = makeArgs({ error: apiError(429), state });
    const result = await processor.processAPIError(args as any);

    expect(result).toEqual({ retry: false });
    const part = args.writer.custom.mock.calls[0][0].data;
    expect(part).toMatchObject({ to: null, reason: 'pool-exhausted', from: { id: seeded.accountB.id } });
  });

  it('hops on a persistent outage (5xx that exhausted the transient budget)', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(500) });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: false });
    expect(args.writer.custom.mock.calls[0][0].data).toMatchObject({
      to: null,
      reason: 'persistent-outage',
      provider: PROVIDER,
    });
    // No rotation happened for an outage.
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
  });

  it('does nothing on 400 and on unknown providers', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    const badRequest = makeArgs({ error: apiError(400) });
    expect(await processor.processAPIError(badRequest as any)).toEqual({ retry: false });
    expect(badRequest.writer.custom).not.toHaveBeenCalled();

    const unknownProvider = makeArgs({ error: apiError(429, { url: 'https://api.unknown-provider.dev/v1' }) });
    expect(await processor.processAPIError(unknownProvider as any)).toEqual({ retry: false });
    expect(unknownProvider.writer.custom).not.toHaveBeenCalled();
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
  });

  it('identifies the provider from the error url host and falls back to the model id', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    const byModelId = makeArgs({ error: apiError(429, { url: null, modelId: 'mastracode/anthropic/claude-fable-5' }) });
    expect(await processor.processAPIError(byModelId as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });

    // A kimi host does not touch the anthropic registry.
    const kimi = makeArgs({ error: apiError(429, { url: 'https://api.kimi.com/coding/v1/chat/completions' }) });
    expect(await processor.processAPIError(kimi as any)).toEqual({ retry: false });
  });

  it('rotates through the request-scoped tenant store, never the host registry', async () => {
    const seeded = await makeTwoAccountStorage();
    const tenantAccounts = [
      { id: 'anthropic:tenant-a', label: 'Tenant A' },
      { id: 'anthropic:tenant-b', label: 'Tenant B' },
    ];
    const tenantActivate = vi.fn(() => tenantAccounts[1]);
    const tenantStore: CredentialStore = {
      reload: () => {},
      get: () => undefined,
      getStoredApiKey: () => undefined,
      getApiKey: async () => undefined,
      listAccounts: () => tenantAccounts,
      getActiveAccount: () => tenantAccounts[0],
      activateAccount: tenantActivate,
    };
    setCredentialStoreProvider(() => tenantStore);
    try {
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
      const args = makeArgs({ error: apiError(429), requestContext });

      expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
      expect(tenantActivate).toHaveBeenCalledWith(PROVIDER, 'anthropic:tenant-b');
      expect(args.writer.custom.mock.calls[0][0].data).toMatchObject({
        to: { id: 'anthropic:tenant-b' },
        reason: 'rate-limit',
      });
      // The host auth.json is untouched by the tenant run.
      expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
    } finally {
      setCredentialStoreProvider(undefined);
    }
  });

  it('no-ops with a store lacking registry methods (deployed mode)', async () => {
    const deployedStore = {
      reload: () => {},
      get: () => undefined,
      getStoredApiKey: () => undefined,
      getApiKey: async () => undefined,
    };
    const processor = new AccountRotationProcessor({ credentialStore: deployedStore, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(429) });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: false });
    expect(args.writer.custom).not.toHaveBeenCalled();
  });

  it('clears tracking on a fresh request (tried-set is request-scoped)', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    // Request 1: rotate A → B.
    await processor.processAPIError(makeArgs({ error: apiError(429) }) as any);
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });

    // Request 2 (fresh state): rotates B → A again rather than declaring
    // exhaustion from request 1's tried-set.
    const args = makeArgs({ error: apiError(429) });
    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
    expect(args.writer.custom.mock.calls[0][0].data).toMatchObject({
      from: { id: seeded.accountB.id },
      to: { id: seeded.accountA.id },
    });
  });

  it('does not rotate a single-account pool, but declares it exhausted (the pool-end of a rotate-classified error)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'account-rotation-test-'));
    tempDirs.push(dir);
    const storage = new AuthStorage(join(dir, 'auth.json'));
    await storage.addAccount(
      PROVIDER,
      { access: 'only-token', refresh: 'only-refresh', expires: FUTURE },
      { label: 'Solo' },
    );

    const processor = new AccountRotationProcessor({ credentialStore: storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(429) });
    expect(await processor.processAPIError(args as any)).toEqual({ retry: false });
    // No rotation (the cursor cannot move), but the pool-exhausted part fires
    // so the transcript — and any configured pack hop — sees the pool end.
    expect(args.writer.custom).toHaveBeenCalledTimes(1);
    expect(args.writer.custom.mock.calls[0]![0]).toMatchObject({
      type: ACCOUNT_SWITCH_PART_TYPE,
      data: { provider: PROVIDER, to: null, reason: 'pool-exhausted' },
    });
    expect(readAuthJson(join(dir, 'auth.json'))[PROVIDER]).toMatchObject({ access: 'only-token' });
  });

  it('does not treat another provider’s tried accounts as this pool being exhausted', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    // Same request: an earlier provider already burned its two accounts.
    const args = makeArgs({
      error: apiError(429),
      state: { triedInstances: new Set(['github-copilot:a', 'github-copilot:b']) },
    });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    expect(args.writer.custom.mock.calls[0][0].data).toMatchObject({
      reason: 'rate-limit',
      to: { id: seeded.accountB.id },
    });
  });

  it('skips an already-tried instance when activating the next account', async () => {
    const seeded = await makeTwoAccountStorage();
    await seeded.storage.addAccount(
      PROVIDER,
      { access: 'token-c', refresh: 'refresh-c', expires: FUTURE },
      { label: 'Account C' },
    );
    // The cursor sits on A while A and B were both already tried this request.
    seeded.storage.activateAccount(PROVIDER, seeded.accountA.id);
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({
      error: apiError(429),
      state: { triedInstances: new Set([seeded.accountA.id, seeded.accountB.id]) },
    });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    const active = seeded.storage.getActiveAccount?.(PROVIDER);
    expect(active?.id).not.toBe(seeded.accountA.id);
    expect(active?.id).not.toBe(seeded.accountB.id);
  });
});

describe('AccountStartNoticeProcessor.processInput', () => {
  function makeInputArgs(overrides: Partial<Record<string, any>> = {}) {
    return {
      state: {} as Record<string, unknown>,
      messages: [],
      messageList: { marker: 'message-list' },
      systemMessages: [],
      writer: { custom: vi.fn(async () => {}) },
      requestContext: {
        get: (key: string) =>
          key === 'controller' ? { session: { modelId: 'mastracode/anthropic/claude-fable-5' } } : undefined,
      },
      ...overrides,
    };
  }

  it('emits the start notice once when the active account is not the first entry', async () => {
    const seeded = await makeTwoAccountStorage();
    seeded.storage.activateAccount(PROVIDER, seeded.accountB.id);
    const processor = new AccountStartNoticeProcessor({ credentialStore: seeded.storage });
    const args = makeInputArgs();

    await processor.processInput(args as any);

    expect(args.writer.custom).toHaveBeenCalledTimes(1);
    const part = args.writer.custom.mock.calls[0][0];
    expect(part.type).toBe('data-mastracode-account-switch');
    expect(part.data).toMatchObject({
      provider: PROVIDER,
      from: null,
      to: { id: seeded.accountB.id, label: 'Account B' },
      reason: 'starting-on-account',
    });

    // Once per request: a second call on the same state emits nothing more.
    await processor.processInput(args as any);
    expect(args.writer.custom).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the first account is active or the pool has one account', async () => {
    const seeded = await makeTwoAccountStorage();
    const processor = new AccountStartNoticeProcessor({ credentialStore: seeded.storage });
    const args = makeInputArgs();
    await processor.processInput(args as any);
    expect(args.writer.custom).not.toHaveBeenCalled();

    const noModel = makeInputArgs({
      requestContext: { get: () => undefined },
    });
    await processor.processInput(noModel as any);
    expect(noModel.writer.custom).not.toHaveBeenCalled();
  });

  it('selects the pack/model preferred account before the request and skips sticky exhausted accounts', async () => {
    const seeded = await makeTwoAccountStorage();
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: {
          activeModelPackId: 'anthropic',
          packAccountPreferences: {
            anthropic: { 'anthropic/claude-fable-5': seeded.accountA.id },
          },
        },
      }),
      'utf-8',
    );
    const controllerState = {
      activeModelPackId: 'anthropic',
      [THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY]: {
        anthropic: { 'anthropic/claude-fable-5': [seeded.accountA.id] },
      },
    };
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => controllerState,
    });
    const args = makeInputArgs({ requestContext });
    const processor = new AccountStartNoticeProcessor({ credentialStore: seeded.storage });

    await processor.processInput(args as any);

    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountB.id);
    expect(args.writer.custom).toHaveBeenCalledTimes(1);
    expect(args.writer.custom.mock.calls[0]![0]).toMatchObject({
      type: ACCOUNT_SWITCH_PART_TYPE,
      data: {
        from: { id: seeded.accountA.id },
        to: { id: seeded.accountB.id },
        reason: 'preferred-routing',
      },
    });
  });

  it('tries a preferred account before the remaining accounts in insertion order', async () => {
    const seeded = await makeTwoAccountStorage();
    const accountC = await addThirdAccount(seeded.storage);
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: {
          activeModelPackId: 'anthropic',
          packAccountPreferences: {
            anthropic: { 'anthropic/claude-fable-5': seeded.accountB.id },
          },
        },
      }),
      'utf-8',
    );
    let controllerState: Record<string, unknown> = { activeModelPackId: 'anthropic' };
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => controllerState,
      setState: async (updates: Record<string, unknown>) => {
        controllerState = { ...controllerState, ...updates };
      },
      setThreadSetting: vi.fn(async () => {}),
    });
    const inputArgs = makeInputArgs({ requestContext });
    const startProcessor = new AccountStartNoticeProcessor({ credentialStore: seeded.storage });
    await startProcessor.processInput(inputArgs as any);

    const errorArgs = makeArgs({
      state: inputArgs.state,
      writer: inputArgs.writer,
      requestContext,
    });
    const rotationProcessor = new AccountRotationProcessor({
      credentialStore: seeded.storage,
      maxProcessorRetries: 22,
    });
    expect((await rotationProcessor.processAPIError({ ...errorArgs, error: apiError(429) } as never)).retry).toBe(true);
    expect((await rotationProcessor.processAPIError({ ...errorArgs, error: apiError(429) } as never)).retry).toBe(true);

    const destinations = inputArgs.writer.custom.mock.calls
      .map(call => call[0])
      .filter(part => part.type === ACCOUNT_SWITCH_PART_TYPE && part.data.to)
      .map(part => part.data.to.id);
    expect(destinations).toEqual([seeded.accountB.id, seeded.accountA.id, accountC.id]);
  });

  it('fails before provider execution when every routed account is already exhausted', async () => {
    const seeded = await makeTwoAccountStorage();
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: { activeModelPackId: 'anthropic', packAccountPreferences: {} },
      }),
      'utf-8',
    );
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => ({
        activeModelPackId: 'anthropic',
        [THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY]: {
          anthropic: { 'anthropic/claude-fable-5': [seeded.accountA.id, seeded.accountB.id] },
        },
      }),
    });
    const args = makeInputArgs({ requestContext });

    await expect(
      new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(args as any),
    ).rejects.toThrow('All saved anthropic subscriptions are exhausted');
    expect(args.writer.custom).not.toHaveBeenCalled();
  });

  it('applies sticky exhaustion when subscription routing is Automatic', async () => {
    const seeded = await makeTwoAccountStorage();
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: { activeModelPackId: 'anthropic', packAccountPreferences: {} },
      }),
      'utf-8',
    );
    let controllerState: Record<string, unknown> = {
      activeModelPackId: 'anthropic',
      [THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY]: {
        anthropic: { 'anthropic/claude-fable-5': [seeded.accountA.id] },
      },
    };
    const setState = vi.fn(async (updates: Record<string, unknown>) => {
      controllerState = { ...controllerState, ...updates };
    });
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => controllerState,
      setState,
      setThreadSetting: vi.fn(async () => {}),
      isThreadActive: () => false,
    });
    const inputArgs = makeInputArgs({ requestContext });
    await new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(inputArgs as any);

    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountB.id);
    const errorArgs = makeArgs({ state: inputArgs.state, writer: inputArgs.writer, requestContext });
    const result = await new AccountRotationProcessor({
      credentialStore: seeded.storage,
      maxProcessorRetries: 22,
    }).processAPIError({ ...errorArgs, error: apiError(429) } as never);
    expect(result.retry).toBe(false);
    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountB.id);
    expect(setState).not.toHaveBeenCalled();
  });
});

describe('pack-fallback parts', () => {
  function seedSettingsWithFallbacks(
    packFallbacks: Record<string, string>,
    packAccountPreferences?: Record<string, Record<string, string>>,
  ) {
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        models: { packFallbacks, packAccountPreferences },
      }),
      'utf-8',
    );
  }

  function makeControllerArgs(modelId: string, modeId = 'build', activeModelPackId = modelId.split('/')[0]) {
    const emitEvent = vi.fn();
    const setState = vi.fn(async () => {});
    const setThreadSetting = vi.fn(async () => {});
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId, modeId },
      threadId: 'thread-1',
      getState: () => ({ activeModelPackId }),
      emitEvent,
      setState,
      setThreadSetting,
    });
    return makeArgs({ requestContext, emitEvent, setState, setThreadSetting });
  }

  it('emits a pack-fallback part (and live info event) when the exhausted pool has a fallback pack', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await processor.processAPIError({ ...args, error: apiError(429) } as never);
      expect(result.retry).toBe(attempt === 0);
    }

    const parts = args.writer.custom.mock.calls.map(call => call[0]);
    const packPart = parts.find(part => part.type === PACK_FALLBACK_PART_TYPE);
    expect(packPart?.data).toMatchObject({
      from: { packId: 'anthropic', label: 'Anthropic' },
      to: { packId: 'openai', label: 'OpenAI' },
      reason: 'pool-exhausted',
    });
    expect(args.emitEvent).toHaveBeenCalledWith({
      type: 'info',
      message: expect.stringContaining('Switched model pack: Anthropic → OpenAI'),
    });
    // Stickiness trigger: session state carries the landed pack + its model
    // for the current mode, written before the info event.
    const pendingHop = expect.objectContaining({
      fromPackId: 'anthropic',
      toPackId: 'openai',
      toModelId: 'openai/gpt-5.6-sol',
      threadId: 'thread-1',
      reason: 'pool-exhausted',
    });
    expect(args.setThreadSetting).toHaveBeenCalledWith({ key: PACK_FALLBACK_STATE_KEY, value: pendingHop });
    expect(args.setState).toHaveBeenCalledWith({ [PACK_FALLBACK_STATE_KEY]: pendingHop });
    expect(args.setThreadSetting.mock.invocationCallOrder[0]).toBeLessThan(
      args.writer.custom.mock.invocationCallOrder.at(-1)!,
    );
    expect(args.writer.custom.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      args.setState.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('re-evaluates subscription routing when a fallback pack lands', async () => {
    const seeded = await makeTwoAccountStorage();
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'openai-a', refresh: 'openai-refresh-a', expires: FUTURE },
      { label: 'OpenAI A' },
    );
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'openai-b', refresh: 'openai-refresh-b', expires: FUTURE },
      { label: 'OpenAI B' },
    );
    const [openaiA, openaiB] = seeded.storage.listAccounts('openai-codex');
    seeded.storage.activateAccount('openai-codex', openaiA!.id);
    seedSettingsWithFallbacks({ anthropic: 'openai' }, { openai: { 'openai/gpt-5.6-sol': openaiB!.id } });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    await processor.processAPIError({ ...args, error: apiError(429) } as never);
    await processor.processAPIError({ ...args, error: apiError(429) } as never);

    expect(seeded.storage.getActiveAccount('openai-codex')?.id).toBe(openaiB!.id);
    expect(
      args.writer.custom.mock.calls.map(([part]) => part).find(part => part.data?.reason === 'preferred-routing'),
    ).toMatchObject({
      type: ACCOUNT_SWITCH_PART_TYPE,
      data: {
        provider: 'openai-codex',
        from: { id: openaiA!.id },
        to: { id: openaiB!.id },
      },
    });
  });

  it('does not activate the target pack preferred account when the hop transcript write fails', async () => {
    const seeded = await makeTwoAccountStorage();
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'openai-a', refresh: 'openai-refresh-a', expires: FUTURE },
      { label: 'OpenAI A' },
    );
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'openai-b', refresh: 'openai-refresh-b', expires: FUTURE },
      { label: 'OpenAI B' },
    );
    const [openaiA, openaiB] = seeded.storage.listAccounts('openai-codex');
    seeded.storage.activateAccount('openai-codex', openaiA!.id);
    seedSettingsWithFallbacks({ anthropic: 'openai' }, { openai: { 'openai/gpt-5.6-sol': openaiB!.id } });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');
    args.writer.custom.mockImplementation(async part => {
      if (part.type === PACK_FALLBACK_PART_TYPE) throw new Error('transcript unavailable');
    });

    await processor.processAPIError({ ...args, error: apiError(429) } as never);
    await expect(processor.processAPIError({ ...args, error: apiError(429) } as never)).rejects.toThrow(
      'transcript unavailable',
    );

    // The provider-global active account for the target pack is untouched:
    // activation happens only after the hop is durable.
    expect(seeded.storage.getActiveAccount('openai-codex')?.id).toBe(openaiA!.id);
    expect(
      args.writer.custom.mock.calls.map(([part]) => part).find(part => part.data?.reason === 'preferred-routing'),
    ).toBeUndefined();
  });

  it('re-arms the start notice on a hop so the retried request re-applies target-pack routing', async () => {
    const seeded = await makeTwoAccountStorage();
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'openai-a', refresh: 'openai-refresh-a', expires: FUTURE },
      { label: 'OpenAI A' },
    );
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'openai-b', refresh: 'openai-refresh-b', expires: FUTURE },
      { label: 'OpenAI B' },
    );
    const [openaiA, openaiB] = seeded.storage.listAccounts('openai-codex');
    seeded.storage.activateAccount('openai-codex', openaiA!.id);
    seedSettingsWithFallbacks({ anthropic: 'openai' }, { openai: { 'openai/gpt-5.6-sol': openaiB!.id } });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');
    // A switch on the original attempt set the once-per-request guard; the
    // hop must clear it so the retry on the target pack re-applies routing.
    args.state.startNoticeEmitted = true;
    // Force the hop-time best-effort activation to fail (swallowed), leaving
    // only the start-notice backstop to land the preferred account.
    const originalActivate = seeded.storage.activateAccount.bind(seeded.storage);
    let openaiActivations = 0;
    seeded.storage.activateAccount = ((providerId: string, accountId: string) => {
      if (providerId === 'openai-codex' && openaiActivations++ === 0) {
        throw new Error('activation unavailable');
      }
      return originalActivate(providerId, accountId);
    }) as typeof seeded.storage.activateAccount;

    await processor.processAPIError({ ...args, error: apiError(429) } as never);
    await processor.processAPIError({ ...args, error: apiError(429) } as never);

    expect(args.state.startNoticeEmitted).toBe(false);
    expect(seeded.storage.getActiveAccount('openai-codex')?.id).toBe(openaiA!.id);

    args.writer.custom.mockImplementation(async () => {});
    const pendingHop = args.setState.mock.calls
      .map(([updates]) => (updates as Record<string, unknown>)[PACK_FALLBACK_STATE_KEY])
      .find(value => value && typeof value === 'object');
    const retryContext = new RequestContext();
    retryContext.set('controller', {
      session: { modelId: 'openai/gpt-5.6-sol', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => ({ mastracodePendingPackFallback: pendingHop }),
    });
    const retryArgs = {
      state: args.state,
      messageList: { marker: 'message-list' },
      writer: args.writer,
      requestContext: retryContext,
    };
    await new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(retryArgs as any);

    expect(seeded.storage.getActiveAccount('openai-codex')?.id).toBe(openaiB!.id);
    expect(
      args.writer.custom.mock.calls.map(([part]) => part).find(part => part.data?.reason === 'preferred-routing'),
    ).toMatchObject({ data: { to: { id: openaiB!.id } } });
  });

  it('does not reuse exhausted accounts when the fallback pack uses the same provider', async () => {
    const seeded = await makeTwoAccountStorage();
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
    mkdirSync(appDataDir, { recursive: true });
    writeFileSync(
      join(appDataDir, 'settings.json'),
      JSON.stringify({
        onboarding: { completedAt: '2026-01-01T00:00:00.000Z', skippedAt: null, version: 1 },
        customModelPacks: [
          { name: 'Primary', models: { build: 'anthropic/claude-fable-5' } },
          { name: 'Fallback', models: { build: 'anthropic/claude-fable-5' } },
        ],
        models: { packFallbacks: { 'custom:Primary': 'custom:Fallback' }, packAccountPreferences: {} },
      }),
      'utf-8',
    );
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5', 'build', 'custom:Primary');

    expect(await processor.processAPIError({ ...args, error: apiError(429) } as never)).toEqual({ retry: true });
    expect(await processor.processAPIError({ ...args, error: apiError(429) } as never)).toEqual({ retry: false });

    // Exhaustion is recorded as a flag, not a sentinel id: a sentinel would
    // reach credential lookup and make `get()` fall back to the active
    // (exhausted) account. The only recorded selection is the real account the
    // fallback pack's routing landed on.
    expect(isRequestAccountRoutingExhausted(args.requestContext, PROVIDER)).toBe(true);
    expect(getRequestAccountSelection(args.requestContext, PROVIDER)).toBe(seeded.accountB.id);
    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountB.id);
  });

  it('fails every credential read once routing marks the provider exhausted', async () => {
    const seeded = await makeTwoAccountStorage();
    const requestContext = new RequestContext();
    markRequestAccountRoutingExhausted(requestContext, PROVIDER);
    const scoped = createRequestScopedCredentialStore(seeded.storage, requestContext);

    // Falling through to the base store would hand back the active account —
    // the one routing just rejected.
    expect(scoped.get(PROVIDER)).toBeUndefined();
    expect(scoped.getStoredApiKey(PROVIDER)).toBeUndefined();
    expect(await scoped.getApiKey(PROVIDER)).toBeUndefined();
    expect(await scoped.getOAuthCredential?.(PROVIDER)).toBeUndefined();
    // A different provider on the same request is unaffected.
    seeded.storage.setStoredApiKey('openai-codex', 'sk-other');
    expect(scoped.getStoredApiKey('openai-codex')).toBe('sk-other');
  });

  it('persists exhausted accounts per pack/model so later requests do not retry the preference', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks(
      {},
      {
        anthropic: { 'anthropic/claude-fable-5': seeded.accountA.id },
      },
    );
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    expect(await processor.processAPIError({ ...args, error: apiError(429) } as never)).toEqual({ retry: true });

    const routingWrite = args.setThreadSetting.mock.calls.find(
      ([setting]) => setting.key === THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY,
    )?.[0];
    expect(routingWrite).toEqual({
      key: THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY,
      value: {
        anthropic: { 'anthropic/claude-fable-5': [seeded.accountA.id] },
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      threadId: 'thread-1',
      getState: () => ({
        activeModelPackId: 'anthropic',
        [THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY]: routingWrite?.value,
      }),
    });
    const nextArgs = {
      state: {} as Record<string, unknown>,
      messages: [],
      messageList: { marker: 'message-list' },
      systemMessages: [],
      writer: { custom: vi.fn(async () => {}) },
      requestContext,
    };
    await new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(nextArgs as any);

    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountB.id);
    expect(nextArgs.writer.custom.mock.calls[0]![0].data).toMatchObject({
      to: { id: seeded.accountB.id },
      reason: 'starting-on-account',
    });
  });

  it('serializes concurrent sticky-exhaustion merges for the same thread', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    let persisted: unknown;
    const makeConcurrentArgs = (accountId: string) => {
      const requestContext = new RequestContext();
      setRequestAccountSelection(requestContext, PROVIDER, accountId);
      requestContext.set('controller', {
        session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
        threadId: 'thread-1',
        getState: () => ({ activeModelPackId: 'anthropic' }),
        getThreadSetting: vi.fn(async () => persisted),
        setThreadSetting: vi.fn(async ({ value }: { value: unknown }) => {
          await new Promise(resolve => setTimeout(resolve, 5));
          persisted = value;
        }),
        isThreadActive: () => false,
      });
      return makeArgs({ requestContext });
    };
    const argsA = makeConcurrentArgs(seeded.accountA.id);
    const argsB = makeConcurrentArgs(seeded.accountB.id);
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    await Promise.all([
      processor.processAPIError({ ...argsA, error: apiError(429) } as never),
      processor.processAPIError({ ...argsB, error: apiError(429) } as never),
    ]);

    expect(persisted).toEqual({
      anthropic: { 'anthropic/claude-fable-5': [seeded.accountA.id, seeded.accountB.id] },
    });
  });

  it('does not resurrect a route cleared while a rotation write is in flight', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    const routeKey = 'anthropic/claude-fable-5';
    // Account A is already excluded, so this rotation is leaving B and its write
    // adds B. A clear issued in that window must land after the write, not between
    // the write's read and its commit.
    let persisted: unknown = { anthropic: { [routeKey]: [seeded.accountA.id] } };
    const writes: unknown[] = [];
    let releaseRead: () => void = () => {};
    const readGate = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    let signalReadStarted: () => void = () => {};
    const readStarted = new Promise<void>(resolve => {
      signalReadStarted = resolve;
    });
    let gated = false;
    const controller = {
      session: { modelId: routeKey, modeId: 'build' },
      threadId: 'thread-1',
      getState: () => ({ activeModelPackId: 'anthropic', [THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY]: persisted }),
      getThreadSetting: vi.fn(async (key: string) => {
        if (key === THREAD_ACCOUNT_ROUTING_EXHAUSTED_KEY) {
          if (!gated) {
            gated = true;
            signalReadStarted();
            await readGate;
          }
          return persisted;
        }
        return undefined;
      }),
      setThreadSetting: vi.fn(async ({ value }: { value: unknown }) => {
        writes.push(value);
        persisted = value;
      }),
      setState: vi.fn(async () => {}),
      isThreadActive: () => true,
    };
    const requestContext = new RequestContext();
    setRequestAccountSelection(requestContext, PROVIDER, seeded.accountB.id);
    requestContext.set('controller', controller);
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    // Park the rotation between its read and its write.
    const rotation = processor.processAPIError({ ...makeArgs({ requestContext }), error: apiError(429) } as never);
    await readStarted;
    // Issued while the rotation is parked, so it can only land after the commit.
    const clear = clearExhaustedAccountRoute(controller, { packId: 'anthropic', modelId: routeKey });
    releaseRead();
    await Promise.all([rotation, clear]);

    // The rotation committed first, then the clear read that result and removed the
    // route. Were the clear unsynchronized it would have written `undefined` first
    // and the rotation's stale snapshot would have put account A back.
    expect(writes).toEqual([{ anthropic: { [routeKey]: [seeded.accountA.id, seeded.accountB.id] } }, undefined]);
    expect(persisted).toBeUndefined();
  });

  it('does not notify live fallback state when the transcript hop cannot be written', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');
    args.writer.custom.mockImplementation(async part => {
      if (part.type === PACK_FALLBACK_PART_TYPE) throw new Error('transcript unavailable');
    });

    await processor.processAPIError({ ...args, error: apiError(429) } as never);
    await expect(processor.processAPIError({ ...args, error: apiError(429) } as never)).rejects.toThrow(
      'transcript unavailable',
    );

    expect(args.setState).not.toHaveBeenCalledWith(
      expect.objectContaining({ [PACK_FALLBACK_STATE_KEY]: expect.anything() }),
    );
    expect(args.setThreadSetting).toHaveBeenLastCalledWith({ key: PACK_FALLBACK_STATE_KEY, value: undefined });
    expect(args.emitEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Switched model pack') }),
    );
  });

  it('attributes the hop to the explicit active pack when packs share a model', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ 'custom:Shared Model': 'openai' });
    const settingsPath = join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json');
    const raw = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    raw.models.activeModelPackId = 'anthropic';
    raw.customModelPacks = [
      {
        name: 'Shared Model',
        models: { build: 'anthropic/claude-fable-5' },
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    writeFileSync(settingsPath, JSON.stringify(raw), 'utf-8');
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5', 'build', 'custom:Shared Model');

    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }

    const packPart = args.writer.custom.mock.calls
      .map(call => call[0])
      .find(part => part.type === PACK_FALLBACK_PART_TYPE);
    expect(packPart?.data.from).toEqual({ packId: 'custom:Shared Model', label: 'Shared Model' });
    expect(packPart?.data.to).toEqual({ packId: 'openai', label: 'OpenAI' });
  });

  it('advances the cascade position on a second hop in the same request', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai', openai: 'github-copilot' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    // Hop 1: anthropic pool exhausts.
    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }
    // Hop 2: the request is now on the openai pack; a persistent outage there
    // advances the cascade to github-copilot.
    await processor.processAPIError({
      ...args,
      retryCount: 2,
      error: apiError(500, { url: 'https://api.openai.com/v1/responses' }),
    } as never);

    const packParts = args.writer.custom.mock.calls
      .map(call => call[0])
      .filter(part => part.type === PACK_FALLBACK_PART_TYPE);
    expect(packParts.map(part => [part.data.from.packId, part.data.to.packId])).toEqual([
      ['anthropic', 'openai'],
      ['openai', 'github-copilot'],
    ]);
  });

  it('attributes an error without request metadata to the cascade model after a hop', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai', openai: 'github-copilot' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }
    const result = await processor.processAPIError({
      ...args,
      retryCount: 2,
      error: new ProviderAuthRequiredError('Fallback provider login expired'),
    } as never);

    expect(result).toEqual({ retry: false });
    const parts = args.writer.custom.mock.calls.map(call => call[0]);
    expect(parts.filter(part => part.type === ACCOUNT_SWITCH_PART_TYPE)).toHaveLength(2);
    expect(
      parts
        .filter(part => part.type === PACK_FALLBACK_PART_TYPE)
        .map(part => [part.data.from.packId, part.data.to.packId]),
    ).toEqual([
      ['anthropic', 'openai'],
      ['openai', 'github-copilot'],
    ]);
  });

  it('does not fall back to the original session provider on an unattributable custom-pack error', async () => {
    const seeded = await makeTwoAccountStorage();
    await seeded.storage.addAccount('github-copilot', {
      access: 'copilot-token',
      refresh: 'copilot-refresh',
      expires: FUTURE,
    });
    seedSettingsWithFallbacks({ anthropic: 'custom:cere', 'custom:cere': 'github-copilot' });
    const raw = JSON.parse(readFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), 'utf-8'));
    raw.customModelPacks = [{ name: 'cere', models: { build: 'cerebras/llama-3.3-70b' } }];
    writeFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), JSON.stringify(raw), 'utf-8');
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5', 'build', 'anthropic');

    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }
    args.writer.custom.mockClear();

    const result = await processor.processAPIError({
      ...args,
      retryCount: 2,
      error: new ProviderAuthRequiredError('Custom provider login expired'),
    } as never);

    expect(result).toEqual({ retry: false });
    const parts = args.writer.custom.mock.calls.map(call => call[0]);
    expect(parts.some(part => part.type === ACCOUNT_SWITCH_PART_TYPE)).toBe(false);
    expect(parts.find(part => part.type === PACK_FALLBACK_PART_TYPE)?.data).toMatchObject({
      from: { packId: 'custom:cere' },
      to: { packId: 'github-copilot' },
    });
  });

  it('emits no pack part when the active pack has no fallback configured', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }

    const types = args.writer.custom.mock.calls.map(call => call[0].type);
    expect(types).not.toContain(PACK_FALLBACK_PART_TYPE);
  });

  it('announces the hop even when the failing provider has no account registry', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    // xAI: not seeded → no registry entries; persistent outage hops the pack.
    const result = await processor.processAPIError({
      ...args,
      error: apiError(500, { url: 'https://api.x.ai/v1/responses' }),
    } as never);

    expect(result.retry).toBe(false);
    const packPart = args.writer.custom.mock.calls
      .map(call => call[0])
      .find(part => part.type === PACK_FALLBACK_PART_TYPE);
    expect(packPart?.data.to).toEqual({ packId: 'openai', label: 'OpenAI' });
  });
});

describe('Q14 chain gate (400/unknown never hop packs)', () => {
  function seedSettingsWithFallbacks(packFallbacks: Record<string, string>) {
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
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

  function makeControllerArgs(modelId: string, modeId = 'build', activeModelPackId = modelId.split('/')[0]) {
    const emitEvent = vi.fn();
    const setState = vi.fn(async () => {});
    const setThreadSetting = vi.fn(async () => {});
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId, modeId },
      threadId: 'thread-1',
      getState: () => ({ activeModelPackId }),
      emitEvent,
      setState,
      setThreadSetting,
    });
    return makeArgs({ requestContext, emitEvent, setState, setThreadSetting });
  }

  it('throws TripWire on a 400 when the session pack has an active fallback chain', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');
    const error = apiError(400, { message: 'invalid request: max_tokens too large' });

    const thrown = await processor.processAPIError({ ...args, error } as never).catch(e => e);
    expect(thrown).toBeInstanceOf(TripWire);
    expect((thrown as TripWire).message).toBe('invalid request: max_tokens too large');
    expect((thrown as TripWire).processorId).toBe(processor.id);
    // No rotation, no parts: the cursor and transcript stay untouched.
    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountA.id);
    expect(args.writer.custom).not.toHaveBeenCalled();
  });

  it('surfaces a 400 with retry:false (no TripWire) when no chain is configured', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    const result = await processor.processAPIError({ ...args, error: apiError(400) } as never);
    expect(result.retry).toBe(false);
  });

  it('throws TripWire on an unknown error when a chain is active', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');
    const error = new Error('something unexpected');

    const thrown = await processor.processAPIError({ ...args, error } as never).catch(e => e);
    expect(thrown).toBeInstanceOf(TripWire);
  });

  it('throws TripWire at retry-budget exhaustion when a chain is active', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 3 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    const thrown = await processor
      .processAPIError({ ...args, retryCount: 3, error: apiError(429) } as never)
      .catch(e => e);
    expect(thrown).toBeInstanceOf(TripWire);
    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountA.id);
  });

  it('returns retry:false at retry-budget exhaustion when no chain is configured', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 3 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    const result = await processor.processAPIError({ ...args, retryCount: 3, error: apiError(429) } as never);
    expect(result.retry).toBe(false);
  });

  it('returns retry:false on a 400 when the request is already on the last chain entry', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    // Exhaust the anthropic pool → hop to openai (cascade position advances).
    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }
    // Now on the openai pack (last entry): a 400 surfaces plainly.
    const result = await processor.processAPIError({
      ...args,
      retryCount: 2,
      error: apiError(400, { url: 'https://api.openai.com/v1/responses' }),
    } as never);
    expect(result.retry).toBe(false);
  });

  it('still hops on pool exhaustion with a chain active (gate only covers never-classified errors)', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await processor.processAPIError({ ...args, error: apiError(429) } as never);
      expect(result.retry).toBe(attempt === 0);
    }
    const parts = args.writer.custom.mock.calls.map(call => call[0]);
    expect(parts.some(part => part.type === PACK_FALLBACK_PART_TYPE)).toBe(true);
  });
});

describe('cross-provider cascades', () => {
  function seedSettingsWithFallbacks(packFallbacks: Record<string, string>) {
    const appDataDir = process.env.MASTRA_APP_DATA_DIR!;
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

  function makeControllerArgs(modelId: string, modeId = 'build', activeModelPackId = modelId.split('/')[0]) {
    const emitEvent = vi.fn();
    const setState = vi.fn(async () => {});
    const setThreadSetting = vi.fn(async () => {});
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId, modeId },
      threadId: 'thread-1',
      getState: () => ({ activeModelPackId }),
      emitEvent,
      setState,
      setThreadSetting,
    });
    return makeArgs({ requestContext, emitEvent, setState, setThreadSetting });
  }

  it('scopes the tried-set per provider: the landed pack pool still rotates after a hop', async () => {
    const seeded = await makeTwoAccountStorage();
    // Second provider pool: two Codex accounts.
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'token-c', refresh: 'refresh-c', expires: FUTURE },
      { label: 'Codex C' },
    );
    await seeded.storage.addAccount(
      'openai-codex',
      { access: 'token-d', refresh: 'refresh-d', expires: FUTURE },
      { label: 'Codex D' },
    );
    seeded.storage.activateAccount('openai-codex', seeded.storage.listAccounts('openai-codex')[0]!.id);
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    // Exhaust the anthropic pool → hop to the openai pack.
    for (let attempt = 0; attempt < 2; attempt++) {
      await processor.processAPIError({ ...args, error: apiError(429) } as never);
    }
    // The tried-set now holds both anthropic ids; a Codex 429 must rotate
    // Codex's own pool, not read anthropic's entries as exhaustion.
    const codex429 = apiError(429, { url: 'https://chatgpt.com/backend-api/codex/responses' });
    const rotated = await processor.processAPIError({ ...args, retryCount: 2, error: codex429 } as never);
    expect(rotated.retry).toBe(true);
    const codexAccounts = seeded.storage.listAccounts('openai-codex');
    expect(seeded.storage.getActiveAccount('openai-codex')?.id).toBe(codexAccounts[1]!.id);

    // Second Codex 429: Codex's pool is now genuinely exhausted.
    const exhausted = await processor.processAPIError({ ...args, retryCount: 3, error: codex429 } as never);
    expect(exhausted.retry).toBe(false);
  });

  it('hops (no TripWire) on a persistent outage from a provider outside the OAuth registry', async () => {
    const seeded = await makeTwoAccountStorage();
    // Active pack is a custom pack on an unattributable provider (cerebras,
    // served through the models.dev router) with anthropic as its fallback.
    seedSettingsWithFallbacks({ 'custom:cere': 'anthropic' });
    const raw = JSON.parse(readFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), 'utf-8'));
    raw.customModelPacks = [{ name: 'cere', models: { build: 'cerebras/llama-3.3-70b' } }];
    writeFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), JSON.stringify(raw), 'utf-8');
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('cerebras/llama-3.3-70b', 'build', 'custom:cere');
    const error = apiError(500, { url: 'https://api.cerebras.ai/v1/chat/completions' });

    const result = await processor.processAPIError({ ...args, error } as never);
    expect(result.retry).toBe(false);
    const parts = args.writer.custom.mock.calls.map(call => call[0]);
    const packPart = parts.find(part => part.type === PACK_FALLBACK_PART_TYPE);
    expect(packPart?.data).toMatchObject({
      from: { packId: 'custom:cere' },
      to: { packId: 'anthropic' },
      reason: 'persistent-outage',
    });
    // No account part: the provider has no registry to declare unavailable.
    expect(parts.some(part => part.type === ACCOUNT_SWITCH_PART_TYPE)).toBe(false);
  });

  it('still TripWires a 400 from a provider outside the OAuth registry', async () => {
    const seeded = await makeTwoAccountStorage();
    seedSettingsWithFallbacks({ 'custom:cere': 'anthropic' });
    const raw = JSON.parse(readFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), 'utf-8'));
    raw.customModelPacks = [{ name: 'cere', models: { build: 'cerebras/llama-3.3-70b' } }];
    writeFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), JSON.stringify(raw), 'utf-8');
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('cerebras/llama-3.3-70b', 'build', 'custom:cere');
    const error = apiError(400, { url: 'https://api.cerebras.ai/v1/chat/completions' });

    const thrown = await processor.processAPIError({ ...args, error } as never).catch(e => e);
    expect(thrown).toBeInstanceOf(TripWire);
  });
});
