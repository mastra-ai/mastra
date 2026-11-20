import { describe, expect, it } from 'vitest';

import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { fromPickerValue, toPickerProviders, toPickerValue } from '../modelPickerCatalog';

const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'gpt-5', hasApiKey: true, releaseDate: '2025-08-07' },
  { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
  { id: 'openai/gpt-4.1', provider: 'openai', modelName: 'gpt-4.1', hasApiKey: true },
];

describe('toPickerProviders', () => {
  it('groups the catalog by provider, sorted, with provider names and model ids within the provider', () => {
    expect(toPickerProviders(models)).toEqual([
      { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-sonnet-4-5', releaseDate: undefined }] },
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-5', releaseDate: '2025-08-07' },
          { id: 'gpt-4.1', releaseDate: undefined },
        ],
      },
    ]);
  });

  it('lists a model the catalog lacks under a not-connected provider so it still shows as selected', () => {
    const providers = toPickerProviders(models, 'deepseek/deepseek-chat');

    expect(providers.map(provider => provider.id)).toEqual(['anthropic', 'deepseek', 'openai']);
    expect(providers[1]).toEqual({
      id: 'deepseek',
      name: expect.any(String),
      connected: false,
      models: [{ id: 'deepseek-chat' }],
    });
  });

  it('adds a missing model to its provider when that provider is already connected', () => {
    const openai = toPickerProviders(models, 'openai/o3').find(provider => provider.id === 'openai');

    expect(openai?.connected).toBeUndefined();
    expect(openai?.models.map(model => model.id)).toEqual(['gpt-5', 'gpt-4.1', 'o3']);
  });

  it('adds nothing when the extra model is in the catalog', () => {
    expect(toPickerProviders(models, 'openai/gpt-5')).toEqual(toPickerProviders(models));
  });
});

describe('picker values', () => {
  it('round-trips catalog ids', () => {
    for (const model of models) {
      const value = toPickerValue(models, model.id);
      expect(value).toEqual({ provider: model.provider, model: model.modelName });
      expect(fromPickerValue(models, value!)).toBe(model.id);
    }
  });

  it('takes the provider of an id outside the catalog from its prefix', () => {
    expect(toPickerValue(models, 'deepseek/deepseek-chat')).toEqual({ provider: 'deepseek', model: 'deepseek-chat' });
    expect(fromPickerValue(models, { provider: 'deepseek', model: 'deepseek-chat' })).toBe('deepseek/deepseek-chat');
  });

  it('has no value without a model id', () => {
    expect(toPickerValue(models, undefined)).toBeUndefined();
    expect(toPickerValue(models, null)).toBeUndefined();
  });
});
