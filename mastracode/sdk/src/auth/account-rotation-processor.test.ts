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

import {
  ACCOUNT_SWITCH_PART_TYPE,
  PACK_FALLBACK_PART_TYPE,
  PACK_FALLBACK_STATE_KEY,
  AccountRotationProcessor,
  AccountStartNoticeProcessor,
  classifyRotationError,
} from './account-rotation-processor.js';
import { ProviderAuthRequiredError } from './provider-auth-error.js';
import { anthropicOAuthProvider } from './providers/anthropic.js';
import { AuthStorage } from './storage.js';

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
function makeTwoAccountStorage(): SeededStorage {
  const dir = mkdtempSync(join(tmpdir(), 'account-rotation-test-'));
  tempDirs.push(dir);
  const authPath = join(dir, 'auth.json');
  const storage = new AuthStorage(authPath);
  storage.addAccount(PROVIDER, { access: 'token-a', refresh: 'refresh-a', expires: FUTURE }, { label: 'Account A' });
  storage.addAccount(PROVIDER, { access: 'token-b', refresh: 'refresh-b', expires: FUTURE }, { label: 'Account B' });
  storage.activateAccount(PROVIDER, storage.listAccounts(PROVIDER)[0]!.id);
  const [a, b] = storage.listAccounts(PROVIDER);
  return { storage, authPath, accountA: { id: a.id, label: a.label }, accountB: { id: b.id, label: b.label } };
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
  it('rotates immediately on 429 and 402', () => {
    expect(classifyRotationError(apiError(429))).toEqual({ kind: 'rotate', reason: 'rate-limit' });
    expect(classifyRotationError(apiError(402))).toEqual({ kind: 'rotate', reason: 'quota-exhausted' });
  });

  it('rotates on provider usage-limit wording regardless of status', () => {
    expect(
      classifyRotationError(apiError(400, { message: 'You have exceeded your usage limit for Claude Max' })),
    ).toEqual({ kind: 'rotate', reason: 'quota-exhausted' });
    expect(
      classifyRotationError(apiError(400, { message: 'Your weekly limit has been reached, try again later' })),
    ).toEqual({ kind: 'rotate', reason: 'quota-exhausted' });
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
});

describe('AccountRotationProcessor.processAPIError', () => {
  it.each([429, 402])(
    'rotates to the next account on %d, persists the switch part, swaps the slot',
    async statusCode => {
      const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({
      error: apiError(400, { message: 'Usage limit reached for your Claude Max plan' }),
    });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });
    expect(args.writer.custom.mock.calls[0][0].data.reason).toBe('quota-exhausted');
  });

  it('retries the same account when a forced refresh succeeds on 401 (no part, no cursor move)', async () => {
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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
    const seeded2 = makeTwoAccountStorage();
    const processor2 = new AccountRotationProcessor({ credentialStore: seeded2.storage, maxProcessorRetries: 22 });
    const bare = makeArgs({ error: new ProviderAuthRequiredError('Not logged in to Anthropic.') });
    expect(await processor2.processAPIError(bare as any)).toEqual({ retry: false });
    expect(readAuthJson(seeded2.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
  });

  it('does not rotate or emit a part once the shared retry budget is spent', async () => {
    // Core discards retry:true when processorRetryCount >= maxProcessorRetries
    // (llm-execution-step canRetryError); rotating anyway would record a
    // switch that never happens.
    const seeded = makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(429), retryCount: 22 });

    expect(await processor.processAPIError(args as any)).toEqual({ retry: false });
    expect(args.writer.custom).not.toHaveBeenCalled();
    expect(args.rotateResponseMessageId).not.toHaveBeenCalled();
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-a' });
  });

  it('forces the 401 refresh only once per request per provider', async () => {
    const seeded = makeTwoAccountStorage();
    const refreshToken = vi
      .spyOn(anthropicOAuthProvider, 'refreshToken')
      .mockResolvedValue({ access: 'token-a-fresh', refresh: 'refresh-a-fresh', expires: FUTURE });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeArgs({ error: apiError(401) });

    // First 401: refresh succeeds → retry same account.
    await processor.processAPIError(args as any);
    // Retry fails again with 401 (fresh-but-rejected): no second forced
    // refresh — rotate instead.
    vi.spyOn(anthropicOAuthProvider, 'refreshToken').mockRejectedValue(new Error('refresh rejected'));
    const secondArgs = makeArgs({ error: apiError(401), state: args.state });
    await processor.processAPIError(secondArgs as any);
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });
  });

  it('declares the pool exhausted when every account has been tried', async () => {
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });

    const byModelId = makeArgs({ error: apiError(429, { url: null, modelId: 'mastracode/anthropic/claude-fable-5' }) });
    expect(await processor.processAPIError(byModelId as any)).toEqual({ retry: true });
    expect(readAuthJson(seeded.authPath)[PROVIDER]).toMatchObject({ access: 'token-b' });

    // A kimi host does not touch the anthropic registry.
    const kimi = makeArgs({ error: apiError(429, { url: 'https://api.kimi.com/coding/v1/chat/completions' }) });
    expect(await processor.processAPIError(kimi as any)).toEqual({ retry: false });
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
    const seeded = makeTwoAccountStorage();
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
    storage.addAccount(PROVIDER, { access: 'only-token', refresh: 'only-refresh', expires: FUTURE }, { label: 'Solo' });

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
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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
});

describe('pack-fallback parts', () => {
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

  function makeControllerArgs(modelId: string, modeId = 'build') {
    const emitEvent = vi.fn();
    const setState = vi.fn(async () => {});
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId, modeId }, emitEvent, setState });
    return makeArgs({ requestContext, emitEvent, setState });
  }

  it('emits a pack-fallback part (and live info event) when the exhausted pool has a fallback pack', async () => {
    const seeded = makeTwoAccountStorage();
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
    expect(args.setState).toHaveBeenCalledWith({
      [PACK_FALLBACK_STATE_KEY]: expect.objectContaining({
        fromPackId: 'anthropic',
        toPackId: 'openai',
        toModelId: 'openai/gpt-5.6-sol',
        reason: 'pool-exhausted',
      }),
    });
  });

  it('advances the cascade position on a second hop in the same request', async () => {
    const seeded = makeTwoAccountStorage();
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

  it('emits no pack part when the active pack has no fallback configured', async () => {
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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

  function makeControllerArgs(modelId: string, modeId = 'build') {
    const emitEvent = vi.fn();
    const setState = vi.fn(async () => {});
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId, modeId }, emitEvent, setState });
    return makeArgs({ requestContext, emitEvent, setState });
  }

  it('throws TripWire on a 400 when the session pack has an active fallback chain', async () => {
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    const result = await processor.processAPIError({ ...args, error: apiError(400) } as never);
    expect(result.retry).toBe(false);
  });

  it('throws TripWire on an unknown error when a chain is active', async () => {
    const seeded = makeTwoAccountStorage();
    seedSettingsWithFallbacks({ anthropic: 'openai' });
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('anthropic/claude-fable-5');
    const error = new Error('something unexpected');

    const thrown = await processor.processAPIError({ ...args, error } as never).catch(e => e);
    expect(thrown).toBeInstanceOf(TripWire);
  });

  it('throws TripWire at retry-budget exhaustion when a chain is active', async () => {
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
    seedSettingsWithFallbacks({});
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 3 });
    const args = makeControllerArgs('anthropic/claude-fable-5');

    const result = await processor.processAPIError({ ...args, retryCount: 3, error: apiError(429) } as never);
    expect(result.retry).toBe(false);
  });

  it('returns retry:false on a 400 when the request is already on the last chain entry', async () => {
    const seeded = makeTwoAccountStorage();
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
    const seeded = makeTwoAccountStorage();
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

  function makeControllerArgs(modelId: string, modeId = 'build') {
    const emitEvent = vi.fn();
    const setState = vi.fn(async () => {});
    const requestContext = new RequestContext();
    requestContext.set('controller', { session: { modelId, modeId }, emitEvent, setState });
    return makeArgs({ requestContext, emitEvent, setState });
  }

  it('scopes the tried-set per provider: the landed pack pool still rotates after a hop', async () => {
    const seeded = makeTwoAccountStorage();
    // Second provider pool: two Codex accounts.
    seeded.storage.addAccount(
      'openai-codex',
      { access: 'token-c', refresh: 'refresh-c', expires: FUTURE },
      { label: 'Codex C' },
    );
    seeded.storage.addAccount(
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
    const seeded = makeTwoAccountStorage();
    // Active pack is a custom pack on an unattributable provider (cerebras,
    // served through the models.dev router) with anthropic as its fallback.
    seedSettingsWithFallbacks({ 'custom:cere': 'anthropic' });
    const raw = JSON.parse(readFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), 'utf-8'));
    raw.customModelPacks = [{ name: 'cere', models: { build: 'cerebras/llama-3.3-70b' } }];
    writeFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), JSON.stringify(raw), 'utf-8');
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('cerebras/llama-3.3-70b');
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
    const seeded = makeTwoAccountStorage();
    seedSettingsWithFallbacks({ 'custom:cere': 'anthropic' });
    const raw = JSON.parse(readFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), 'utf-8'));
    raw.customModelPacks = [{ name: 'cere', models: { build: 'cerebras/llama-3.3-70b' } }];
    writeFileSync(join(process.env.MASTRA_APP_DATA_DIR!, 'settings.json'), JSON.stringify(raw), 'utf-8');
    const processor = new AccountRotationProcessor({ credentialStore: seeded.storage, maxProcessorRetries: 22 });
    const args = makeControllerArgs('cerebras/llama-3.3-70b');
    const error = apiError(400, { url: 'https://api.cerebras.ai/v1/chat/completions' });

    const thrown = await processor.processAPIError({ ...args, error } as never).catch(e => e);
    expect(thrown).toBeInstanceOf(TripWire);
  });
});
