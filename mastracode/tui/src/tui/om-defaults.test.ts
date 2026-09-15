import type { GlobalSettings } from '@mastra/code-sdk/onboarding/settings';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyProviderOMDefaultIfUnconfigured } from './om-defaults.js';
import type { TUIState } from './state.js';

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

function settingsFixture(): GlobalSettings {
  return {
    onboarding: { omPackId: null },
    models: {
      activeOmPackId: null,
      omModelOverride: null,
      observerModelOverride: null,
      reflectorModelOverride: null,
    },
  } as unknown as GlobalSettings;
}

function stateFixture() {
  const set = vi.fn(async () => {});
  return { set, state: { session: { state: { set } } } as unknown as TUIState };
}

describe('applyProviderOMDefaultIfUnconfigured', () => {
  let settings: GlobalSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = settingsFixture();
    vi.mocked(loadSettings).mockReturnValue(settings);
  });

  it('seeds the OM pack of the provider that just authenticated', async () => {
    const { state, set } = stateFixture();

    await expect(applyProviderOMDefaultIfUnconfigured(state, 'openai-codex')).resolves.toMatchObject({
      id: 'openai',
      modelId: 'openai/gpt-5.4-mini',
    });
    expect(settings.onboarding.omPackId).toBe('openai');
    expect(settings.models.activeOmPackId).toBe('openai');
    expect(settings.models.omModelOverride).toBeNull();
    expect(saveSettings).toHaveBeenCalledWith(settings);
    expect(set).toHaveBeenCalledWith({
      observerModelId: 'openai/gpt-5.4-mini',
      reflectorModelId: 'openai/gpt-5.4-mini',
    });
  });

  it('leaves OM untouched for a provider with no OM pack', async () => {
    const { state, set } = stateFixture();

    await expect(applyProviderOMDefaultIfUnconfigured(state, 'github-copilot')).resolves.toBeUndefined();
    expect(settings.onboarding.omPackId).toBeNull();
    expect(settings.models.activeOmPackId).toBeNull();
    expect(saveSettings).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('keeps an OM model the user already chose', async () => {
    settings.models.observerModelOverride = 'custom/observer';
    const { state, set } = stateFixture();

    await expect(applyProviderOMDefaultIfUnconfigured(state, 'anthropic')).resolves.toBeUndefined();
    expect(settings.models.activeOmPackId).toBeNull();
    expect(saveSettings).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
});
