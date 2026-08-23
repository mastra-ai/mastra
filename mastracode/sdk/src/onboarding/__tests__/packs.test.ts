import { describe, expect, it } from 'vitest';

import { PROVIDER_DEFAULT_MODELS } from '../../auth/storage.js';
import {
  getAvailableModePacks,
  getAvailableOmPacks,
  OPENCODE_DEFAULT_MODEL_ID,
  openCodeAccessLevel,
  resolveProviderOMDefault,
  selectPreferredOMPack,
  type ProviderAccess,
} from '../packs.js';

function providerAccess(overrides: Partial<ProviderAccess> = {}): ProviderAccess {
  return {
    anthropic: false,
    openai: false,
    cerebras: false,
    google: false,
    deepseek: false,
    'github-copilot': false,
    opencode: false,
    ...overrides,
  };
}

describe('getAvailableModePacks', () => {
  it('uses GPT-5.6 for OpenAI plan and build modes while keeping fast on GPT-5.4 mini', () => {
    const packs = getAvailableModePacks({
      anthropic: false,
      openai: 'oauth',
      cerebras: false,
      google: false,
      deepseek: false,
      'github-copilot': false,
    });

    expect(packs.find(pack => pack.id === 'openai')?.models).toEqual({
      plan: 'openai/gpt-5.6-sol',
      build: 'openai/gpt-5.6-sol',
      fast: 'openai/gpt-5.4-mini',
    });
  });

  it('keeps the OpenAI OAuth post-login default aligned with the build model', () => {
    const packs = getAvailableModePacks({
      anthropic: false,
      openai: 'oauth',
      cerebras: false,
      google: false,
      deepseek: false,
      'github-copilot': false,
    });

    expect(PROVIDER_DEFAULT_MODELS['openai-codex']).toBe(packs.find(pack => pack.id === 'openai')?.models.build);
  });

  it('exposes a GitHub Copilot pack with defaults for build, plan, and fast modes', () => {
    const packs = getAvailableModePacks({
      anthropic: false,
      openai: false,
      cerebras: false,
      google: false,
      deepseek: false,
      'github-copilot': 'oauth',
    });

    const pack = packs.find(p => p.id === 'github-copilot');
    expect(pack).toBeDefined();
    expect(pack?.models).toEqual({
      plan: 'github-copilot/gemini-2.5-pro',
      build: 'github-copilot/gpt-4.1',
      fast: 'github-copilot/grok-code-fast-1',
    });
  });

  it('keeps the GitHub Copilot OAuth post-login default aligned with the build model', () => {
    const packs = getAvailableModePacks({
      anthropic: false,
      openai: false,
      cerebras: false,
      google: false,
      deepseek: false,
      'github-copilot': 'oauth',
    });

    expect(PROVIDER_DEFAULT_MODELS['github-copilot']).toBe(
      packs.find(pack => pack.id === 'github-copilot')?.models.build,
    );
  });

  it('hides the GitHub Copilot pack when access is unavailable', () => {
    const packs = getAvailableModePacks(providerAccess());

    expect(packs.find(p => p.id === 'github-copilot')).toBeUndefined();
  });

  it('exposes an OpenCode Zen pack on the free tier with no credential', () => {
    const packs = getAvailableModePacks(providerAccess({ opencode: openCodeAccessLevel(false) }));

    const pack = packs.find(p => p.id === 'opencode');
    expect(pack).toBeDefined();
    expect(pack?.description).toBe('Free models — no API key needed');
    expect(pack?.models).toEqual({
      build: OPENCODE_DEFAULT_MODEL_ID,
      plan: OPENCODE_DEFAULT_MODEL_ID,
      fast: OPENCODE_DEFAULT_MODEL_ID,
    });
  });

  it('labels the OpenCode Zen pack as key-backed when a Zen API key is present', () => {
    const packs = getAvailableModePacks(providerAccess({ opencode: openCodeAccessLevel(true) }));

    expect(packs.find(p => p.id === 'opencode')?.description).toBe('All OpenCode Zen models via API key');
  });

  it('hides the OpenCode Zen pack when access is unavailable', () => {
    const packs = getAvailableModePacks(providerAccess());

    expect(packs.find(p => p.id === 'opencode')).toBeUndefined();
  });
});

describe('OM packs', () => {
  it.each([
    ['anthropic', 'anthropic', 'anthropic/claude-haiku-4-5'],
    ['openai-codex', 'openai', 'openai/gpt-5.4-mini'],
    ['openai', 'openai', 'openai/gpt-5.4-mini'],
    ['google', 'gemini', 'google/gemini-3.5-flash'],
    ['opencode', 'opencode', OPENCODE_DEFAULT_MODEL_ID],
  ])('maps %s to the %s OM pack', (providerId, packId, modelId) => {
    expect(resolveProviderOMDefault(providerId)).toMatchObject({ id: packId, modelId });
  });

  it('uses the selected provider model for unsupported providers', () => {
    expect(resolveProviderOMDefault('xai', 'xai/grok-4.5')).toMatchObject({
      id: 'custom',
      modelId: 'xai/grok-4.5',
    });
  });

  it('lists only reachable packs, labelled by how each provider is reached', () => {
    const packs = getAvailableOmPacks(providerAccess({ google: 'apikey', anthropic: 'oauth', deepseek: 'apikey' }));

    expect(packs).toEqual([
      { id: 'gemini', name: 'Gemini Flash', description: 'Via Google API key', modelId: 'google/gemini-3.5-flash' },
      {
        id: 'anthropic',
        name: 'Claude Haiku',
        description: 'Via Max subscription',
        modelId: 'anthropic/claude-haiku-4-5',
      },
      { id: 'deepseek', name: 'DeepSeek', description: 'Via DeepSeek API key', modelId: 'deepseek/deepseek-v4-flash' },
      { id: 'custom', name: 'Custom', description: 'Choose any available model', modelId: '' },
    ]);
  });

  it('offers the custom pack even when no provider is reachable', () => {
    expect(getAvailableOmPacks(providerAccess())).toEqual([
      { id: 'custom', name: 'Custom', description: 'Choose any available model', modelId: '' },
    ]);
  });
});

describe('selectPreferredOMPack', () => {
  it('prefers the matching reachable provider over earlier packs', () => {
    const pack = selectPreferredOMPack(providerAccess({ anthropic: 'oauth', openai: 'oauth' }), 'openai-codex');

    expect(pack).toMatchObject({ id: 'openai', modelId: 'openai/gpt-5.4-mini' });
  });

  it('ignores a selected provider that is not reachable', () => {
    const pack = selectPreferredOMPack(providerAccess({ anthropic: 'oauth' }), 'openai-codex');

    expect(pack).toMatchObject({ id: 'anthropic', modelId: 'anthropic/claude-haiku-4-5' });
  });

  it('prefers OAuth access when no provider is selected', () => {
    const pack = selectPreferredOMPack(providerAccess({ google: 'apikey', anthropic: 'oauth' }));

    expect(pack).toMatchObject({ id: 'anthropic', modelId: 'anthropic/claude-haiku-4-5' });
  });

  it('falls back to the first reachable API-key pack', () => {
    const pack = selectPreferredOMPack(providerAccess({ google: 'apikey', deepseek: 'apikey' }));

    expect(pack).toMatchObject({ id: 'gemini', modelId: 'google/gemini-3.5-flash' });
  });
});
