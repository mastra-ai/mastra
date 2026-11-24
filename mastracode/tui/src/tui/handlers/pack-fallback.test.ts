import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  resolveDefaultThinkingLevel: vi.fn(),
  listResolvableModePacks: vi.fn(),
  applyPackToSession: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  resolveDefaultThinkingLevel: mocks.resolveDefaultThinkingLevel,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY: 'activeModelPackId',
  THREAD_FALLBACK_STATUS_KEY: 'mastracodeFallbackStatus',
}));
vi.mock('../model-packs/apply.js', () => ({
  listResolvableModePacks: mocks.listResolvableModePacks,
  applyPackToSession: mocks.applyPackToSession,
}));

import type { PackFallbackStatus } from '../state.js';
import { handlePackFallbackState, leaveExpiredPackFallback } from './pack-fallback.js';
import type { EventHandlerContext } from './types.js';

const KEY = 'mastracodePendingModelFallback';
const RETRY_AT = '2026-10-05T00:05:00.000Z';

function makeContext({
  fallbackStatus,
  streaming = false,
}: { fallbackStatus?: PackFallbackStatus; streaming?: boolean } = {}) {
  const currentThread = { id: 'thread-1' };
  const stateSet = vi.fn(async () => undefined);
  const threadSetSetting = vi.fn(async () => undefined);
  const currentThreadSetSetting = vi.fn(async () => undefined);
  const ectx = {
    state: {
      session: {
        state: { get: vi.fn(() => ({})), set: stateSet },
        thread: { getId: () => currentThread.id, setSettingOn: threadSetSetting, setSetting: currentThreadSetSetting },
        mode: { get: vi.fn(() => 'build') },
        stream: { isActive: () => streaming },
      },
      fallbackStatus,
    },
    updateStatusLine: vi.fn(),
    refreshModelAuthStatus: vi.fn(async () => undefined),
  } as unknown as EventHandlerContext;
  return { ectx, currentThread, stateSet, threadSetSetting, currentThreadSetSetting };
}

function pending(overrides: Record<string, unknown> = {}) {
  return {
    fromEntryId: 'anthropic',
    toEntryId: 'openai',
    toModelId: 'openai/gpt-5.6-sol',
    threadId: 'thread-1',
    reason: 'pool-exhausted',
    at: '2026-10-05T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadSettings.mockReturnValue({
    models: { activeModelPackId: 'anthropic' },
    preferences: { thinkingLevel: 'low' },
  });
  mocks.resolveDefaultThinkingLevel.mockReturnValue({ level: 'low', source: 'global' });
  mocks.listResolvableModePacks.mockReturnValue([
    { id: 'anthropic', name: 'Anthropic' },
    { id: 'openai', name: 'OpenAI' },
  ]);
  mocks.applyPackToSession.mockImplementation(async (_ctx, _packId, options) => {
    const selection = {
      modelId: 'openai/gpt-5.6-sol',
      modelRoute: { entries: [{ id: 'openai', modelId: 'openai/gpt-5.6-sol' }] },
    };
    await options?.afterApply?.(selection);
    return { ...selection, applied: true };
  });
});

describe('handlePackFallbackState', () => {
  it('ignores unrelated and cleared state changes', async () => {
    const { ectx, stateSet } = makeContext();

    await handlePackFallbackState(ectx, { state: {}, changedKeys: ['other'] });
    await handlePackFallbackState(ectx, { state: { [KEY]: null }, changedKeys: [KEY] });

    expect(stateSet).not.toHaveBeenCalled();
    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
  });

  it('clears a malformed generic fallback marker', async () => {
    const { ectx, stateSet, threadSetSetting } = makeContext();

    await handlePackFallbackState(ectx, { state: { [KEY]: { reason: 'pool-exhausted' } }, changedKeys: [KEY] });

    expect(threadSetSetting).toHaveBeenCalledWith({ threadId: 'thread-1', key: KEY, value: undefined });
    expect(stateSet).toHaveBeenCalledWith({ [KEY]: null });
    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
  });

  it('clears a malformed marker on the thread that wrote it', async () => {
    const { ectx, stateSet, threadSetSetting } = makeContext();

    await handlePackFallbackState(ectx, {
      state: { [KEY]: { toEntryId: 'openai', threadId: 'thread-origin' } },
      changedKeys: [KEY],
    });

    expect(threadSetSetting).toHaveBeenCalledWith({ threadId: 'thread-origin', key: KEY, value: undefined });
    expect(stateSet).not.toHaveBeenCalled();
    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
  });

  it('does not apply a delayed hop after the active thread changes', async () => {
    const { ectx, threadSetSetting } = makeContext();

    await handlePackFallbackState(ectx, {
      state: { [KEY]: pending({ threadId: 'thread-before-switch' }) },
      changedKeys: [KEY],
    });

    expect(threadSetSetting).not.toHaveBeenCalled();
    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
  });

  it('maps the route entry to a TUI pack, remembers when the failed pack can be retried, and clears the marker last', async () => {
    const { ectx, stateSet, threadSetSetting } = makeContext();
    const status = { usingPack: 'OpenAI', failedPack: 'Anthropic', failedPackId: 'anthropic', retryAt: RETRY_AT };

    await handlePackFallbackState(ectx, {
      state: { [KEY]: pending({ failure: { kind: 'rate_limited', retryAt: RETRY_AT } }) },
      changedKeys: [KEY],
    });

    expect(threadSetSetting.mock.calls).toEqual([
      [{ threadId: 'thread-1', key: 'mastracodeFallbackStatus', value: status }],
      [{ threadId: 'thread-1', key: KEY, value: undefined }],
    ]);
    expect(mocks.applyPackToSession).toHaveBeenCalledWith(
      ectx,
      'openai',
      expect.objectContaining({ clearPendingFallback: false, afterApply: expect.any(Function) }),
    );
    expect(stateSet).toHaveBeenLastCalledWith({ [KEY]: null });
    expect(ectx.state.fallbackStatus).toEqual(status);
  });

  it('does not finalize a fallback when pack application is superseded', async () => {
    const { ectx, stateSet, threadSetSetting } = makeContext();
    mocks.applyPackToSession.mockResolvedValueOnce({
      modelId: 'openai/gpt-5.6-sol',
      modelRoute: { entries: [{ id: 'openai', modelId: 'openai/gpt-5.6-sol' }] },
      applied: false,
    });

    await handlePackFallbackState(ectx, { state: { [KEY]: pending() }, changedKeys: [KEY] });

    expect(threadSetSetting).not.toHaveBeenCalled();
    expect(stateSet).not.toHaveBeenCalled();
    expect(ectx.state.fallbackStatus).toBeUndefined();
  });

  it('clears the pending marker when pack application fails', async () => {
    const { ectx, stateSet, threadSetSetting } = makeContext();
    mocks.applyPackToSession.mockRejectedValueOnce(new Error('apply failed'));

    await expect(handlePackFallbackState(ectx, { state: { [KEY]: pending() }, changedKeys: [KEY] })).rejects.toThrow(
      'apply failed',
    );

    expect(threadSetSetting).toHaveBeenCalledWith({ threadId: 'thread-1', key: KEY, value: undefined });
    expect(stateSet).toHaveBeenCalledWith({ [KEY]: null });
  });

  it('clears a marker whose target entry is no longer a pack', async () => {
    const { ectx, threadSetSetting } = makeContext();

    await handlePackFallbackState(ectx, {
      state: { [KEY]: pending({ toEntryId: 'removed-pack' }) },
      changedKeys: [KEY],
    });

    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
    expect(threadSetSetting).toHaveBeenCalledWith({ threadId: 'thread-1', key: KEY, value: undefined });
  });
});

describe('leaveExpiredPackFallback', () => {
  const held: PackFallbackStatus = {
    usingPack: 'OpenAI',
    failedPack: 'Anthropic',
    failedPackId: 'anthropic',
    retryAt: RETRY_AT,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('goes back to the failed pack once its retry time has passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse(RETRY_AT) });
    const { ectx, currentThreadSetSetting } = makeContext({ fallbackStatus: held });

    await leaveExpiredPackFallback(ectx);

    expect(mocks.applyPackToSession).toHaveBeenCalledWith(ectx, 'anthropic', expect.anything());
    expect(currentThreadSetSetting).toHaveBeenCalledWith({ key: 'mastracodeFallbackStatus', value: undefined });
    expect(ectx.state.fallbackStatus).toBeUndefined();
  });

  it('drops the fallback status when the failed pack no longer exists', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse(RETRY_AT) });
    mocks.listResolvableModePacks.mockReturnValue([{ id: 'openai', name: 'OpenAI' }]);
    const { ectx, currentThreadSetSetting } = makeContext({ fallbackStatus: held });

    await leaveExpiredPackFallback(ectx);

    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
    expect(currentThreadSetSetting).toHaveBeenCalledWith({ key: 'mastracodeFallbackStatus', value: undefined });
    expect(ectx.state.fallbackStatus).toBeUndefined();
  });

  it.each([
    ['before the retry time', held, Date.parse(RETRY_AT) - 1_000, false],
    [
      'without a retry time',
      { usingPack: 'OpenAI', failedPack: 'Anthropic', failedPackId: 'anthropic' },
      Date.parse(RETRY_AT),
      false,
    ],
    ['while a run is still streaming', held, Date.parse(RETRY_AT), true],
  ])('stays on the fallback %s', async (_case, fallbackStatus, now, streaming) => {
    vi.useFakeTimers({ toFake: ['Date'], now });
    const { ectx } = makeContext({ fallbackStatus, streaming });

    await leaveExpiredPackFallback(ectx);

    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
    expect(ectx.state.fallbackStatus).toEqual(fallbackStatus);
  });
});
