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
import { dirname, join } from 'node:path';
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
import {
  ACCOUNT_SWITCH_PART_TYPE,
  MODEL_FALLBACK_PART_TYPE,
  MODEL_FALLBACK_STATE_KEY,
  AccountRotationProcessor,
  AccountStartNoticeProcessor,
  accountSwitchNoticeText,
  classifyRotationError,
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
const KIMI_PROVIDER = 'kimi-for-coding';
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
  setCredentialStoreProvider(undefined);
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

function makeRouteContext(options: {
  modelId: string;
  entries: Array<{ id: string; label: string; modelId: string; accountId?: string; memoryModelId?: string }>;
  threadId?: string;
}) {
  const state: Record<string, unknown> = { modelRoute: { entries: options.entries } };
  const persisted: Record<string, unknown> = {};
  const order: string[] = [];
  const requestContext = new RequestContext();
  const setThreadSetting = vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
    order.push('setting');
    persisted[key] = value;
  });
  const setState = vi.fn(async (updates: Record<string, unknown>) => {
    order.push('state');
    Object.assign(state, updates);
  });
  const emitEvent = vi.fn();
  requestContext.set('controller', {
    session: { modelId: options.modelId, modeId: 'build' },
    threadId: options.threadId ?? 'thread-1',
    getState: () => state,
    setThreadSetting,
    setState,
    emitEvent,
  });
  return { requestContext, state, persisted, order, setThreadSetting, setState, emitEvent };
}

function makeInputArgs(requestContext: RequestContext) {
  return {
    state: {} as Record<string, unknown>,
    messageList: [],
    systemMessages: [],
    writer: { custom: vi.fn(async () => {}) },
    requestContext,
  };
}

describe('AccountStartNoticeProcessor model routes', () => {
  it('selects the route entry account before the request starts', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        {
          id: 'primary',
          label: 'Primary',
          modelId: 'anthropic/claude-fable-5',
          accountId: seeded.accountB.id,
        },
      ],
    });
    const args = makeInputArgs(route.requestContext);

    await new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(args as never);

    expect(getRequestAccountSelection(route.requestContext, PROVIDER)).toBe(seeded.accountB.id);
    expect((args.state as Record<string, unknown>).startNoticeEmitted).toBe(true);
  });

  it('fails closed when the route pins a missing account', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        {
          id: 'primary',
          label: 'Primary',
          modelId: 'anthropic/claude-fable-5',
          accountId: 'anthropic:missing',
        },
      ],
    });
    const args = makeInputArgs(route.requestContext);

    await new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(args as never);

    expect(isRequestAccountRoutingExhausted(route.requestContext, PROVIDER)).toBe(true);
    expect(createRequestScopedCredentialStore(seeded.storage, route.requestContext).get(PROVIDER)).toBeUndefined();
  });

  it('keeps the active account without announcing it when no model route is supplied', async () => {
    const seeded = await makeTwoAccountStorage();
    seeded.storage.activateAccount(PROVIDER, seeded.accountB.id);
    const requestContext = new RequestContext();
    requestContext.set('controller', {
      session: { modelId: 'anthropic/claude-fable-5', modeId: 'build' },
      getState: () => ({}),
    });
    const args = makeInputArgs(requestContext);

    await new AccountStartNoticeProcessor({ credentialStore: seeded.storage }).processInput(args as never);

    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountB.id);
    expect(args.writer.custom).not.toHaveBeenCalled();
  });
});

describe('model-route fallback parts', () => {
  it('hops to the next route entry and persists the generic marker before live state', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        {
          id: 'anthropic',
          label: 'Anthropic',
          modelId: 'anthropic/claude-fable-5',
          accountId: seeded.accountA.id,
        },
        { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol' },
      ],
    });
    const args = makeArgs({ error: apiError(429), requestContext: route.requestContext });
    args.writer.custom.mockImplementation(async () => {
      route.order.push('part');
    });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: false });

    const pending = {
      fromEntryId: 'anthropic',
      toEntryId: 'openai',
      toModelId: 'openai/gpt-5.6-sol',
      threadId: 'thread-1',
      reason: 'pool-exhausted',
    };
    expect(route.persisted[MODEL_FALLBACK_STATE_KEY]).toMatchObject(pending);
    expect(route.state[MODEL_FALLBACK_STATE_KEY]).toMatchObject(pending);
    expect(route.order).toEqual(['part', 'setting', 'part', 'state']);
    expect(args.writer.custom).toHaveBeenCalledWith({
      type: MODEL_FALLBACK_PART_TYPE,
      data: expect.objectContaining({
        from: { entryId: 'anthropic', label: 'Anthropic' },
        to: { entryId: 'openai', label: 'OpenAI' },
        reason: 'pool-exhausted',
      }),
    });
  });

  it('advances through multiple route entries in one request', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        {
          id: 'anthropic',
          label: 'Anthropic',
          modelId: 'anthropic/claude-fable-5',
          accountId: seeded.accountA.id,
        },
        { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol', accountId: 'openai:missing' },
        { id: 'copilot', label: 'Copilot', modelId: 'github-copilot/gpt-4.1' },
      ],
    });
    const args = makeArgs({ error: apiError(429), requestContext: route.requestContext });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: false });
    expect(await processor.processAPIError({ ...args, error: apiError(429) } as never)).toEqual({ retry: false });

    const parts = args.writer.custom.mock.calls
      .map(call => call[0])
      .filter(part => part.type === MODEL_FALLBACK_PART_TYPE);
    expect(parts).toHaveLength(2);
    expect(parts[1]?.data).toMatchObject({
      from: { entryId: 'openai' },
      to: { entryId: 'copilot' },
    });
  });

  it('uses the pending route entry as the cascade start on an immediate retrigger', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' },
        { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol', accountId: 'openai:missing' },
        { id: 'copilot', label: 'Copilot', modelId: 'github-copilot/gpt-4.1' },
      ],
    });
    route.state.mastracodePendingModelFallback = {
      fromEntryId: 'anthropic',
      toEntryId: 'openai',
      toModelId: 'openai/gpt-5.6-sol',
      threadId: 'thread-1',
      reason: 'pool-exhausted',
      at: '2026-10-05T00:00:00.000Z',
    };
    const args = makeArgs({
      error: apiError(429, { url: null, modelId: 'openai/gpt-5.6-sol' }),
      requestContext: route.requestContext,
    });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: false });

    const part = args.writer.custom.mock.calls
      .map(call => call[0])
      .find(item => item.type === MODEL_FALLBACK_PART_TYPE);
    expect(part?.data).toMatchObject({ from: { entryId: 'openai' }, to: { entryId: 'copilot' } });
  });

  it('does not reuse exhausted accounts when the next route entry uses the same provider', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        {
          id: 'primary',
          label: 'Primary',
          modelId: 'anthropic/claude-fable-5',
          accountId: seeded.accountA.id,
        },
        {
          id: 'secondary',
          label: 'Secondary',
          modelId: 'anthropic/claude-fable-5',
          accountId: seeded.accountB.id,
        },
      ],
    });
    const args = makeArgs({ error: apiError(429), requestContext: route.requestContext });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: false });
    expect(getRequestAccountSelection(route.requestContext, PROVIDER)).toBeUndefined();
    expect(seeded.storage.getActiveAccount(PROVIDER)?.id).toBe(seeded.accountA.id);
    expect(route.state[MODEL_FALLBACK_STATE_KEY]).toMatchObject({ toEntryId: 'secondary' });
  });

  it('does not publish live fallback state when the transcript write fails', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        {
          id: 'primary',
          label: 'Primary',
          modelId: 'anthropic/claude-fable-5',
          accountId: seeded.accountA.id,
        },
        { id: 'fallback', label: 'Fallback', modelId: 'openai/gpt-5.6-sol' },
      ],
    });
    const args = makeArgs({ error: apiError(429), requestContext: route.requestContext });
    args.writer.custom.mockImplementation(async part => {
      if (part.type === MODEL_FALLBACK_PART_TYPE) throw new Error('transcript unavailable');
    });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    await expect(processor.processAPIError(args as never)).rejects.toThrow('transcript unavailable');
    expect(route.persisted[MODEL_FALLBACK_STATE_KEY]).toBeUndefined();
    expect(route.state[MODEL_FALLBACK_STATE_KEY]).toBeUndefined();
    expect(route.setState).not.toHaveBeenCalled();
  });

  it('hops on a persistent outage from a provider without an account registry', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'cerebras/llama-3.3-70b',
      entries: [
        { id: 'cerebras', label: 'Cerebras', modelId: 'cerebras/llama-3.3-70b' },
        { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' },
      ],
    });
    const args = makeArgs({
      error: apiError(500, { url: 'https://api.cerebras.ai/v1/chat/completions' }),
      requestContext: route.requestContext,
    });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: false });
    expect(args.writer.custom).toHaveBeenCalledWith({
      type: MODEL_FALLBACK_PART_TYPE,
      data: expect.objectContaining({
        from: { entryId: 'cerebras', label: 'Cerebras' },
        to: { entryId: 'anthropic', label: 'Anthropic' },
        reason: 'persistent-outage',
      }),
    });
    expect(args.writer.custom).not.toHaveBeenCalledWith(expect.objectContaining({ type: ACCOUNT_SWITCH_PART_TYPE }));
  });

  it('throws TripWire for a never-rotate error while a route fallback remains', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [
        { id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' },
        { id: 'openai', label: 'OpenAI', modelId: 'openai/gpt-5.6-sol' },
      ],
    });
    const args = makeArgs({ error: apiError(400), requestContext: route.requestContext });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    await expect(processor.processAPIError(args as never)).rejects.toBeInstanceOf(TripWire);
    expect(args.writer.custom).not.toHaveBeenCalledWith(expect.objectContaining({ type: MODEL_FALLBACK_PART_TYPE }));
  });

  it('returns retry false when no route fallback remains', async () => {
    const seeded = await makeTwoAccountStorage();
    const route = makeRouteContext({
      modelId: 'anthropic/claude-fable-5',
      entries: [{ id: 'anthropic', label: 'Anthropic', modelId: 'anthropic/claude-fable-5' }],
    });
    const args = makeArgs({ error: apiError(400), requestContext: route.requestContext });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    expect(await processor.processAPIError(args as never)).toEqual({ retry: false });
  });
});
