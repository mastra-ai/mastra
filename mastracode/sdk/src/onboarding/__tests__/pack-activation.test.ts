import { describe, expect, it } from 'vitest';

import {
  activateModePackInSettings,
  listResolvableModePacks,
  listValidModePackIds,
  resolveModePackArg,
} from '../pack-activation.js';
import { listBuiltinModePacks } from '../packs.js';
import type { GlobalSettings } from '../settings.js';

function makeSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    customModelPacks: [
      {
        name: 'Kimi',
        models: {
          plan: 'mastracode/kimi-for-coding/k3',
          build: 'mastracode/kimi-for-coding/k3',
          fast: 'mastracode/kimi-for-coding/k3',
          memory: 'openai/gpt-5.4-nano',
        },
        createdAt: '2026-10-05T00:00:00.000Z',
      },
      {
        name: 'Anthropic',
        models: {
          plan: 'custom/plan',
          build: 'custom/build',
          fast: 'custom/fast',
        },
        createdAt: '2026-10-05T00:00:00.000Z',
      },
    ],
    models: {
      activeModelPackId: undefined,
      modeDefaults: { default: 'anthropic/claude-opus-4-6' },
      modePackOverrides: {},
      subagentModels: {
        explore: 'openai/gpt-5.4-mini',
        plan: 'openai/gpt-5.4-mini',
        execute: 'openai/gpt-5.4-mini',
      },
      packFallbacks: { 'custom:Kimi': 'custom:Anthropic' },
      packAccountPreferences: {},
    },
    ...overrides,
  } as GlobalSettings;
}

describe('listResolvableModePacks', () => {
  it('lists built-in packs first, then custom packs', () => {
    const packs = listResolvableModePacks(makeSettings());

    expect(packs.map(pack => pack.id)).toEqual([
      ...listBuiltinModePacks().map(pack => pack.id),
      'custom:Kimi',
      'custom:Anthropic',
    ]);
  });
});

describe('resolveModePackArg', () => {
  it('resolves built-in pack ids', () => {
    expect(resolveModePackArg(makeSettings(), 'openai')).toEqual({ packId: 'openai' });
  });

  it('resolves custom packs by custom:<name>', () => {
    expect(resolveModePackArg(makeSettings(), 'custom:Kimi')).toEqual({ packId: 'custom:Kimi' });
  });

  it('resolves custom packs by bare name', () => {
    expect(resolveModePackArg(makeSettings(), 'Kimi')).toEqual({ packId: 'custom:Kimi' });
  });

  it('lets a built-in pack win a name collision with a custom pack', () => {
    expect(resolveModePackArg(makeSettings(), 'anthropic')).toEqual({ packId: 'anthropic' });
    expect(resolveModePackArg(makeSettings(), 'custom:Anthropic')).toEqual({ packId: 'custom:Anthropic' });
  });

  it('fails fast for unknown packs and lists valid packs', () => {
    const result = resolveModePackArg(makeSettings(), 'nope');

    expect(result).toHaveProperty('error');
    const error = (result as { error: string }).error;
    expect(error).toContain('nope');
    expect(error).toContain('openai');
    expect(error).toContain('custom:Kimi');
  });
});

describe('listValidModePackIds', () => {
  it('includes built-in and custom pack ids', () => {
    const ids = listValidModePackIds(makeSettings());

    expect(ids).toContain('openai');
    expect(ids).toContain('custom:Kimi');
  });
});

describe('activateModePackInSettings', () => {
  it('activates a built-in pack, clearing mode defaults and subagent overrides', () => {
    const settings = makeSettings();

    activateModePackInSettings(settings, 'openai');

    expect(settings.models?.activeModelPackId).toBe('openai');
    expect(settings.models?.modeDefaults).toEqual({});
    expect(settings.models?.subagentModels).toEqual({});
  });

  it('activates a custom pack and rewrites mode defaults from the pack', () => {
    const settings = makeSettings();

    activateModePackInSettings(settings, 'custom:Kimi');

    expect(settings.models?.activeModelPackId).toBe('custom:Kimi');
    expect(settings.models?.modeDefaults).toEqual({
      plan: 'mastracode/kimi-for-coding/k3',
      build: 'mastracode/kimi-for-coding/k3',
      fast: 'mastracode/kimi-for-coding/k3',
      memory: 'openai/gpt-5.4-nano',
    });
    expect(settings.models?.subagentModels).toEqual({});
  });
});
