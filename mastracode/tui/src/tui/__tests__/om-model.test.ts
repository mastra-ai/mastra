import type { Session } from '@mastra/core/agent-controller';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@mastra/code-sdk/onboarding/settings', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk/onboarding/settings')>()),
  loadSettings: () => settingsMock.value,
}));

const { getEffectiveOMRoleModelId } = await import('../om-model.js');

function packSettings(memory?: string) {
  return {
    models: { activeModelPackId: 'custom:Work', modePackOverrides: {} },
    customModelPacks: [
      {
        name: 'Work',
        createdAt: '2026-01-01T00:00:00.000Z',
        models: { build: 'anthropic/claude-fable-5', ...(memory ? { memory } : {}) },
      },
    ],
  };
}

function session(observerModelId: string) {
  return {
    state: { get: () => ({}) },
    thread: { getId: () => 'thread-1' },
    model: { get: () => 'anthropic/claude-sonnet-4-6' },
    om: { observer: { modelId: () => observerModelId }, reflector: { modelId: () => observerModelId } },
  } as unknown as Session<any>;
}

describe('getEffectiveOMRoleModelId', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    return () => vi.unstubAllEnvs();
  });

  it('reports the /om role model when the active pack leaves memory unset', () => {
    settingsMock.value = packSettings();
    expect(getEffectiveOMRoleModelId(session('openai/gpt-5.4-mini'), 'observer')).toBe('openai/gpt-5.4-mini');
  });

  it("reports the active pack's memory model over a pinned role", () => {
    settingsMock.value = packSettings('deepseek/deepseek-v4-flash');
    expect(getEffectiveOMRoleModelId(session('openai/gpt-5.4-mini'), 'observer')).toBe('deepseek/deepseek-v4-flash');
  });

  it('reports the automatic model when the active pack sets memory to Auto', () => {
    settingsMock.value = packSettings('auto');
    expect(getEffectiveOMRoleModelId(session('openai/gpt-5.4-mini'), 'reflector')).toBe('anthropic/claude-haiku-4-5');
  });
});
