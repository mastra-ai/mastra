/**
 * Unit tests for the pack-fallback stickiness handler: the thread pack switch
 * triggered by a `data-mastracode-pack-fallback` hop.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  listResolvableModePacks: vi.fn(),
  resolveModePackModels: vi.fn(),
  resolveDefaultThinkingLevel: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('@mastra/code-sdk/agents/model', () => ({ listResolvableModePacks: mocks.listResolvableModePacks }));
vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: mocks.loadSettings,
  resolveDefaultThinkingLevel: mocks.resolveDefaultThinkingLevel,
  resolveModePackModels: mocks.resolveModePackModels,
  saveSettings: mocks.saveSettings,
  THREAD_ACTIVE_MODEL_PACK_ID_KEY: 'activeModelPackId',
  THREAD_FALLBACK_STATUS_KEY: 'mastracodeFallbackStatus',
}));

import { handlePackFallbackState } from './message.js';
import type { EventHandlerContext } from './types.js';

const KEY = 'mastracodePendingPackFallback';

function makeContext() {
  const stateSet = vi.fn(async () => {});
  const threadSetSetting = vi.fn(async () => {});
  const modelSwitch = vi.fn(async () => {});
  const subagentSet = vi.fn(async () => {});
  const ectx = {
    state: {
      controller: { listModes: vi.fn(() => [{ id: 'build', defaultModelId: 'anthropic/old' }]) },
      session: {
        state: { get: vi.fn(() => ({})), set: stateSet },
        thread: { getId: () => 'thread-1', setSetting: threadSetSetting },
        mode: { get: vi.fn(() => 'build') },
        model: { switch: modelSwitch },
        subagents: { model: { set: subagentSet } },
      },
      fallbackStatus: undefined,
    },
    updateStatusLine: vi.fn(),
    refreshModelAuthStatus: vi.fn(async () => {}),
  } as unknown as EventHandlerContext;
  return { ectx, stateSet, threadSetSetting, modelSwitch, subagentSet };
}

describe('handlePackFallbackState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSettings.mockReturnValue({
      models: { activeModelPackId: 'anthropic', modeDefaults: {}, subagentModels: {} },
      preferences: { thinkingLevel: 'off' },
    });
    mocks.listResolvableModePacks.mockReturnValue([
      { id: 'anthropic', name: 'Anthropic', models: { build: 'anthropic/old' } },
      { id: 'openai', name: 'OpenAI', models: { build: 'openai/gpt-5.6-sol' } },
    ]);
    mocks.resolveModePackModels.mockImplementation((_settings, pack) => pack.models);
    mocks.resolveDefaultThinkingLevel.mockReturnValue({ level: 'off', source: 'global' });
  });
  it('ignores events that do not touch the pack-fallback key', async () => {
    const { ectx, stateSet } = makeContext();
    await handlePackFallbackState(ectx, { state: {}, changedKeys: ['someOtherKey'] });
    expect(stateSet).not.toHaveBeenCalled();
  });

  it('returns early on a null payload WITHOUT clearing — clearing would re-emit state_changed and loop', async () => {
    const { ectx, stateSet, threadSetSetting, modelSwitch } = makeContext();
    await handlePackFallbackState(ectx, { state: { [KEY]: null }, changedKeys: [KEY] });
    expect(stateSet).not.toHaveBeenCalled();
    expect(threadSetSetting).not.toHaveBeenCalled();
    expect(modelSwitch).not.toHaveBeenCalled();
  });

  it('consumes (clears) a malformed payload without switching packs', async () => {
    const { ectx, stateSet, threadSetSetting, modelSwitch } = makeContext();
    await handlePackFallbackState(ectx, { state: { [KEY]: { reason: 'pool-exhausted' } }, changedKeys: [KEY] });
    expect(threadSetSetting).toHaveBeenCalledWith({ key: KEY, value: undefined });
    expect(stateSet).toHaveBeenCalledWith({ [KEY]: null });
    expect(modelSwitch).not.toHaveBeenCalled();
  });

  it('applies a valid hop and clears its durable pending marker last', async () => {
    const { ectx, stateSet, threadSetSetting, modelSwitch } = makeContext();
    const pending = {
      fromPackId: 'anthropic',
      toPackId: 'openai',
      toModelId: 'openai/gpt-5.6-sol',
      reason: 'pool-exhausted' as const,
      at: '2026-09-14T20:00:00.000Z',
    };

    await handlePackFallbackState(ectx, { state: { [KEY]: pending }, changedKeys: [KEY] });

    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'openai/gpt-5.6-sol' });
    expect(threadSetSetting).toHaveBeenCalledWith({ key: 'modeModelId_build', value: 'openai/gpt-5.6-sol' });
    expect(threadSetSetting).toHaveBeenCalledWith({ key: 'activeModelPackId', value: 'openai' });
    expect(threadSetSetting).toHaveBeenCalledWith({
      key: 'mastracodeFallbackStatus',
      value: { usingPack: 'OpenAI', failedPack: 'Anthropic' },
    });
    expect(threadSetSetting).toHaveBeenLastCalledWith({ key: KEY, value: undefined });
    expect(stateSet).toHaveBeenLastCalledWith({ [KEY]: null });
    expect(mocks.saveSettings).toHaveBeenCalledOnce();
    expect(ectx.state.fallbackStatus).toEqual({ usingPack: 'OpenAI', failedPack: 'Anthropic' });
  });
});
