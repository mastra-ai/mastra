import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoadSettings = vi.hoisted(() => vi.fn());

vi.mock('@mastra/code-sdk/onboarding/settings', async importOriginal => {
  const actual = await importOriginal<typeof import('@mastra/code-sdk/onboarding/settings')>();
  return {
    ...actual,
    loadSettings: mockLoadSettings,
  };
});

import { handleThinkCommand } from '../think.js';

function settingsFixture(overrides?: { modeThinkingDefaults?: Record<string, string>; thinkingLevel?: string }) {
  return {
    models: { modeThinkingDefaults: overrides?.modeThinkingDefaults ?? {} },
    preferences: { thinkingLevel: overrides?.thinkingLevel ?? 'off' },
  } as any;
}

function makeCtx({
  sessionThinkingLevel,
  modeId = 'build',
  modelId = 'anthropic/claude-sonnet-4-5',
}: {
  sessionThinkingLevel?: string;
  modeId?: string;
  modelId?: string;
} = {}) {
  const stateSet = vi.fn(async () => {});
  const showInfo = vi.fn();
  const ctx = {
    showInfo,
    state: {
      session: {
        state: {
          get: () => (sessionThinkingLevel !== undefined ? { thinkingLevel: sessionThinkingLevel } : {}),
          set: stateSet,
        },
        mode: { get: () => modeId },
        model: { get: () => modelId },
      },
      ui: { hideOverlay: vi.fn(), requestRender: vi.fn() },
    },
  } as any;
  return { ctx, stateSet, showInfo };
}

beforeEach(() => {
  mockLoadSettings.mockReset();
  mockLoadSettings.mockImplementation(() => settingsFixture());
});

describe('handleThinkCommand', () => {
  it('status shows the mode default with provenance when no override is set', async () => {
    mockLoadSettings.mockImplementation(() =>
      settingsFixture({ modeThinkingDefaults: { build: 'high' }, thinkingLevel: 'low' }),
    );
    const { ctx, showInfo } = makeCtx();

    await handleThinkCommand(ctx, ['status']);

    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('build mode default'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('High'));
  });

  it('status shows the global default when the mode has no entry', async () => {
    mockLoadSettings.mockImplementation(() => settingsFixture({ thinkingLevel: 'medium' }));
    const { ctx, showInfo } = makeCtx();

    await handleThinkCommand(ctx, ['status']);

    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('global default'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Medium'));
  });

  it('status flags a session override and still reports the underlying default', async () => {
    mockLoadSettings.mockImplementation(() => settingsFixture({ modeThinkingDefaults: { build: 'low' } }));
    const { ctx, showInfo } = makeCtx({ sessionThinkingLevel: 'xhigh' });

    await handleThinkCommand(ctx, ['status']);

    const message = showInfo.mock.calls[0]?.[0] as string;
    expect(message).toContain('session override');
    expect(message).toContain('build mode default');
  });

  it('setting a level writes a session override only (no global persist)', async () => {
    const { ctx, stateSet, showInfo } = makeCtx();

    await handleThinkCommand(ctx, ['high']);

    expect(stateSet).toHaveBeenCalledWith({ thinkingLevel: 'high' });
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('session override'));
  });

  it('"default" clears the session override and reports the inherited level', async () => {
    mockLoadSettings.mockImplementation(() => settingsFixture({ modeThinkingDefaults: { build: 'high' } }));
    const { ctx, stateSet, showInfo } = makeCtx({ sessionThinkingLevel: 'low' });

    await handleThinkCommand(ctx, ['default']);

    expect(stateSet).toHaveBeenCalledWith({ thinkingLevel: undefined });
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('High'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('build mode default'));
  });

  it('rejects invalid levels and lists valid choices', async () => {
    const { ctx, stateSet, showInfo } = makeCtx();

    await handleThinkCommand(ctx, ['turbo']);

    expect(stateSet).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid thinking level'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('max'));
  });

  it('rejects trailing arguments consistently with other interfaces', async () => {
    const { ctx, stateSet, showInfo } = makeCtx();

    await handleThinkCommand(ctx, ['high', 'extra']);

    expect(stateSet).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Invalid thinking level'));
  });
});
