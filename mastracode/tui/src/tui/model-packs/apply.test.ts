import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  settings: undefined as any,
  loadSettings: vi.fn(() => mocks.settings),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/code-sdk/onboarding/settings')>();
  return { ...actual, loadSettings: mocks.loadSettings };
});

import { applyPackToSession, reconcilePackAfterModeChange, resolvePackSelection, switchModeWithPack } from './apply.js';

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
          state: { set: vi.fn(async () => undefined) },
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

  it.each([
    ['build', 'provider/build-primary'],
    ['plan', 'provider/plan-primary'],
    ['fast', 'provider/fast-primary'],
  ])('resolves the %s model from the pack', (modeId, expectedModelId) => {
    expect(resolvePackSelection(mocks.settings, 'custom:Primary', modeId)?.modelId).toBe(expectedModelId);
  });

  it('builds a generic route with account and memory models', () => {
    const selection = resolvePackSelection(mocks.settings, 'custom:Primary', 'build');

    expect(selection?.modelRoute.entries).toEqual([
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
    ]);
  });

  it('applies the model, subagents, OM models, and route', async () => {
    const { ctx, modelSwitch } = makeContext();

    await applyPackToSession(ctx, 'custom:Primary', { modeId: 'build' });

    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/build-primary' });
    expect(ctx.state.session.subagents.model.set).toHaveBeenCalledTimes(3);
    expect(ctx.state.session.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'provider/memory-primary' });
    expect(ctx.state.session.state.set).toHaveBeenCalledWith({
      modelRoute: expect.objectContaining({ entries: expect.any(Array) }),
    });
  });

  it('applies the global pack before a new thread is bound', async () => {
    const { ctx, modelSwitch } = makeContext();
    ctx.state.session.thread.getId.mockReturnValue(undefined);

    await applyPackToSession(ctx, 'custom:Primary', { modeId: 'build' });

    expect(ctx.state.session.thread.setSetting).not.toHaveBeenCalled();
    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/build-primary' });
  });

  it('re-applies the pack model after switching modes', async () => {
    const { ctx, modeSwitch, modelSwitch } = makeContext();

    await switchModeWithPack(ctx, 'plan');

    expect(modeSwitch).toHaveBeenCalledWith({ modeId: 'plan' });
    expect(modelSwitch).toHaveBeenCalledWith({ modelId: 'provider/plan-primary' });
  });

  it('uses the mode-change listener as a no-op safety net when already applied', async () => {
    const { ctx, modelSwitch } = makeContext('provider/plan-primary');

    await reconcilePackAfterModeChange(ctx, 'plan');

    expect(modelSwitch).not.toHaveBeenCalled();
  });
});
