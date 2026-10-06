import { MODEL_FALLBACK_STATE_KEY } from '@mastra/code-sdk/auth/account-rotation-processor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  settings: undefined as any,
  loadSettings: vi.fn(() => mocks.settings),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/code-sdk/onboarding/settings')>();
  return { ...actual, loadSettings: mocks.loadSettings };
});

import {
  applyCurrentThreadPack,
  applyPackToSession,
  reconcilePackAfterModeChange,
  switchModeWithPack,
} from './apply.js';

function makeSettings() {
  return {
    customModelPacks: [
      {
        name: 'Primary',
        models: {
          build: 'provider/build-primary',
          plan: 'provider/plan-primary',
          fast: 'provider/fast-primary',
          memory: 'provider/memory-primary',
        },
        createdAt: '2026-10-05T00:00:00.000Z',
      },
      {
        name: 'Fallback',
        models: {
          build: 'provider/build-fallback',
          plan: 'provider/plan-fallback',
          fast: 'provider/fast-fallback',
          memory: 'provider/memory-fallback',
        },
        createdAt: '2026-10-05T00:00:00.000Z',
      },
    ],
    models: {
      activeModelPackId: 'custom:Primary',
      modeDefaults: {},
      modePackOverrides: {},
      packFallbacks: { 'custom:Primary': 'custom:Fallback' },
      packAccountPreferences: {
        'custom:Primary': { 'provider/build-primary': 'account-primary' },
        'custom:Fallback': { 'provider/build-fallback': 'account-fallback' },
      },
    },
  } as any;
}

function makeContext(modelId = 'provider/old') {
  let currentModelId = modelId;
  let currentModeId = 'build';
  const modelSwitch = vi.fn(async ({ modelId: nextModelId }: { modelId: string }) => {
    currentModelId = nextModelId;
  });
  const modeSwitch = vi.fn(async ({ modeId }: { modeId: string }) => {
    currentModeId = modeId;
  });
  let sessionState: Record<string, unknown> = {};
  const stateSet = vi.fn(async (nextState: Record<string, unknown>) => {
    sessionState = { ...sessionState, ...nextState };
  });
  return {
    ctx: {
      state: {
        controller: {
          listModes: vi.fn(() => [
            { id: 'build', defaultModelId: 'provider/build-default' },
            { id: 'plan', defaultModelId: 'provider/plan-default' },
          ]),
        },
        session: {
          mode: { get: vi.fn(() => currentModeId), switch: modeSwitch },
          model: { get: vi.fn(() => currentModelId), switch: modelSwitch },
          thread: {
            getId: vi.fn(() => 'thread-1'),
            list: vi.fn(async () => [{ id: 'thread-1', metadata: { activeModelPackId: 'custom:Primary' } }]),
            setSetting: vi.fn(async () => undefined),
          },
          subagents: { model: { set: vi.fn(async () => undefined) } },
          om: {
            observer: { switchModel: vi.fn(async () => undefined) },
            reflector: { switchModel: vi.fn(async () => undefined) },
          },
          state: { get: vi.fn(() => sessionState), set: stateSet },
        },
      },
    } as any,
    modelSwitch,
    modeSwitch,
  };
}

describe('model pack application', () => {
  beforeEach(() => {
    mocks.settings = makeSettings();
    vi.clearAllMocks();
  });

  it('applies the pack as session model, subagent, memory, and route primitives', async () => {
    const { ctx, modelSwitch } = makeContext();

    await applyPackToSession(ctx, 'custom:Primary', { modeId: 'build' });

    expect(modelSwitch).toHaveBeenCalledExactlyOnceWith({ modelId: 'provider/build-primary' });
    expect(ctx.state.session.subagents.model.set.mock.calls).toEqual([
      [{ modelId: 'provider/fast-primary', agentType: 'explore' }],
      [{ modelId: 'provider/plan-primary', agentType: 'plan' }],
      [{ modelId: 'provider/build-primary', agentType: 'execute' }],
    ]);
    expect(ctx.state.session.om.observer.switchModel).toHaveBeenCalledExactlyOnceWith({
      modelId: 'provider/memory-primary',
    });
    expect(ctx.state.session.om.reflector.switchModel).toHaveBeenCalledExactlyOnceWith({
      modelId: 'provider/memory-primary',
    });
    expect(ctx.state.session.state.set).toHaveBeenCalledExactlyOnceWith({
      modelRoute: {
        entries: [
          {
            id: 'custom:Primary',
            label: 'Primary',
            modelId: 'provider/build-primary',
            accountId: 'account-primary',
            memoryModelId: 'provider/memory-primary',
          },
          {
            id: 'custom:Fallback',
            label: 'Fallback',
            modelId: 'provider/build-fallback',
            accountId: 'account-fallback',
            memoryModelId: 'provider/memory-fallback',
          },
        ],
      },
      mastracodePendingModelFallback: null,
    });
  });

  it('applies the global pack before a new thread is bound', async () => {
    const { ctx, modelSwitch } = makeContext();
    ctx.state.session.thread.getId.mockReturnValue(undefined);

    await applyPackToSession(ctx, 'custom:Primary', { modeId: 'build' });

    expect(ctx.state.session.thread.setSetting).not.toHaveBeenCalled();
    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/build-primary' });
  });

  it('falls back to the mode default when the active pack is incomplete', async () => {
    mocks.settings.customModelPacks = [
      {
        name: 'Primary',
        models: { plan: 'provider/plan-primary' },
        createdAt: '2026-10-05T00:00:00.000Z',
      },
    ];
    const { ctx, modelSwitch } = makeContext();

    await expect(applyCurrentThreadPack(ctx, { packId: 'custom:Primary' })).resolves.toBeUndefined();

    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/build-default' });
    expect(ctx.state.session.state.set).toHaveBeenCalledWith({
      modelRoute: undefined,
      mastracodePendingModelFallback: null,
    });
  });

  it('preserves the restored model when no pack resolves during thread restore', async () => {
    const { ctx, modelSwitch } = makeContext();

    await expect(applyCurrentThreadPack(ctx, { packId: null, applyModeDefault: false })).resolves.toBeUndefined();

    expect(modelSwitch).not.toHaveBeenCalled();
    expect(ctx.state.session.state.set).toHaveBeenCalledWith({
      modelRoute: undefined,
      mastracodePendingModelFallback: null,
    });
  });

  it('re-applies the pack model after switching modes', async () => {
    const { ctx, modeSwitch, modelSwitch } = makeContext();

    await switchModeWithPack(ctx, 'plan');

    expect(modeSwitch).toHaveBeenCalledWith({ modeId: 'plan' });
    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/plan-primary' });
  });

  it('uses the mode-change listener as a no-op safety net when already applied', async () => {
    const { ctx, modeSwitch, modelSwitch } = makeContext();
    await modeSwitch({ modeId: 'plan' });
    await applyPackToSession(ctx, 'custom:Primary', { modeId: 'plan' });
    modelSwitch.mockClear();

    await reconcilePackAfterModeChange(ctx, 'plan');

    expect(modelSwitch).not.toHaveBeenCalled();
  });

  it('clears a pending fallback when applying the pack for a new mode', async () => {
    const { ctx } = makeContext('provider/build-fallback');

    await switchModeWithPack(ctx, 'plan');

    expect(ctx.state.session.thread.setSetting).toHaveBeenCalledWith({
      key: 'mastracodePendingModelFallback',
      value: undefined,
    });
    expect(ctx.state.session.state.set).toHaveBeenLastCalledWith({
      modelRoute: expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({ id: 'custom:Fallback', modelId: 'provider/plan-fallback' }),
        ]),
      }),
      mastracodePendingModelFallback: null,
    });
  });

  it('ignores a delayed mode-change reconciliation after a newer switch', async () => {
    const { ctx, modeSwitch, modelSwitch } = makeContext('provider/build-primary');
    let resolveThreads = (_threads: Array<{ id: string; metadata: Record<string, unknown> }>) => {};
    ctx.state.session.thread.list.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveThreads = resolve;
        }),
    );
    await modeSwitch({ modeId: 'plan' });
    modelSwitch.mockClear();

    const reconciliation = reconcilePackAfterModeChange(ctx, 'plan');
    await modeSwitch({ modeId: 'fast' });
    resolveThreads([{ id: 'thread-1', metadata: { activeModelPackId: 'custom:Primary' } }]);
    await reconciliation;

    expect(modelSwitch).not.toHaveBeenCalled();
  });

  it('serializes overlapping applications so the newer pack wins', async () => {
    const { ctx, modeSwitch, modelSwitch } = makeContext('provider/build-primary');
    await modeSwitch({ modeId: 'plan' });
    let releaseSetting = () => {};
    ctx.state.session.thread.setSetting.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releaseSetting = resolve;
        }),
    );

    const primaryApplication = applyPackToSession(ctx, 'custom:Primary', { modeId: 'plan' });
    await vi.waitFor(() => expect(ctx.state.session.thread.setSetting).toHaveBeenCalled());
    const fallbackApplication = applyPackToSession(ctx, 'custom:Fallback', { modeId: 'plan' });
    releaseSetting();

    await expect(primaryApplication).resolves.toMatchObject({ applied: false });
    await expect(fallbackApplication).resolves.toMatchObject({ applied: true });
    expect(modelSwitch).toHaveBeenCalledTimes(1);
    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/plan-fallback' });
    expect(ctx.state.session.thread.setSetting).toHaveBeenLastCalledWith({
      key: MODEL_FALLBACK_STATE_KEY,
      value: undefined,
    });
  });

  it('does not apply a resolved pack after the active thread changes', async () => {
    const { ctx, modelSwitch } = makeContext();
    let resolveThreads = (_threads: Array<{ id: string; metadata: Record<string, unknown> }>) => {};
    ctx.state.session.thread.list.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveThreads = resolve;
        }),
    );

    const application = applyCurrentThreadPack(ctx, { modeId: 'build' });
    ctx.state.session.thread.getId.mockReturnValue('thread-2');
    resolveThreads([{ id: 'thread-1', metadata: { activeModelPackId: 'custom:Primary' } }]);
    await application;

    expect(modelSwitch).not.toHaveBeenCalled();
    expect(ctx.state.session.thread.setSetting).not.toHaveBeenCalled();
  });
});
