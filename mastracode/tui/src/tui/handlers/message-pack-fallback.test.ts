import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { handlePackFallbackState } from './message.js';
import type { EventHandlerContext } from './types.js';

const KEY = 'mastracodePendingModelFallback';

function makeContext() {
  const currentThread = { id: 'thread-1' };
  const stateSet = vi.fn(async () => undefined);
  const threadSetSetting = vi.fn(async () => undefined);
  const ectx = {
    state: {
      session: {
        state: { get: vi.fn(() => ({})), set: stateSet },
        thread: { getId: () => currentThread.id, setSettingOn: threadSetSetting },
        mode: { get: vi.fn(() => 'build') },
      },
      fallbackStatus: undefined,
    },
    updateStatusLine: vi.fn(),
    refreshModelAuthStatus: vi.fn(async () => undefined),
  } as unknown as EventHandlerContext;
  return { ectx, currentThread, stateSet, threadSetSetting };
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

describe('handlePackFallbackState', () => {
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

  it('does not apply a delayed hop after the active thread changes', async () => {
    const { ectx, threadSetSetting } = makeContext();

    await handlePackFallbackState(ectx, {
      state: { [KEY]: pending({ threadId: 'thread-before-switch' }) },
      changedKeys: [KEY],
    });

    expect(threadSetSetting).not.toHaveBeenCalled();
    expect(mocks.applyPackToSession).not.toHaveBeenCalled();
  });

  it('maps the route entry to a TUI pack and clears the marker last', async () => {
    const { ectx, stateSet, threadSetSetting } = makeContext();

    await handlePackFallbackState(ectx, { state: { [KEY]: pending() }, changedKeys: [KEY] });

    expect(threadSetSetting.mock.calls).toEqual([
      [
        {
          threadId: 'thread-1',
          key: 'mastracodeFallbackStatus',
          value: { usingPack: 'OpenAI', failedPack: 'Anthropic' },
        },
      ],
      [{ threadId: 'thread-1', key: KEY, value: undefined }],
    ]);
    expect(mocks.applyPackToSession).toHaveBeenCalledWith(
      ectx,
      'openai',
      expect.objectContaining({ clearPendingFallback: false, afterApply: expect.any(Function) }),
    );
    expect(stateSet).toHaveBeenLastCalledWith({ [KEY]: null });
    expect(ectx.state.fallbackStatus).toEqual({ usingPack: 'OpenAI', failedPack: 'Anthropic' });
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
