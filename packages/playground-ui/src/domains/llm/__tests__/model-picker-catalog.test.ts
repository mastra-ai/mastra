import { describe, expect, it } from 'vitest';

import { catalogModelPickerValue, findCatalogModel, modelPickerProviders } from '../model-picker-catalog';

describe('model picker catalog', () => {
  // Gateway ids carry their vendor (`openai/gpt-5`); Factory's catalog names the provider beside the id.
  const gateway = [
    { id: 'openai/gpt-5', releaseDate: '2026-08-07' },
    { id: 'anthropic/claude-opus-4-7' },
    { id: 'openai/gpt-5-mini' },
    { id: 'no-vendor' },
  ];

  it('groups gateway ids by their vendor, in catalog order, and skips ids without one', () => {
    expect(modelPickerProviders(gateway)).toEqual([
      {
        id: 'openai',
        name: 'OpenAI',
        models: [
          { id: 'gpt-5', releaseDate: '2026-08-07' },
          { id: 'gpt-5-mini', releaseDate: undefined },
        ],
      },
      { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-opus-4-7', releaseDate: undefined }] },
    ]);
  });

  it('keeps a model id that has its own slash under the provider it is listed with', () => {
    const value = catalogModelPickerValue({ id: 'openrouter/meta-llama/llama-4', provider: 'openrouter' });
    expect(value).toEqual({ provider: 'openrouter', model: 'meta-llama/llama-4' });
  });

  it('finds the catalog model a picked value stands for, with or without the provider in its id', () => {
    const catalog = [
      { id: 'openai/gpt-5', provider: 'openai' },
      { id: 'claude-opus-4-7', provider: 'anthropic' },
    ];
    expect(findCatalogModel(catalog, { provider: 'openai', model: 'gpt-5' })).toBe(catalog[0]);
    expect(findCatalogModel(catalog, { provider: 'anthropic', model: 'claude-opus-4-7' })).toBe(catalog[1]);
    expect(findCatalogModel(catalog, { provider: 'openai', model: 'claude-opus-4-7' })).toBeUndefined();
  });
});
