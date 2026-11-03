import type { TUI } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';
import { MenuFrame } from '../../prompt-slot.js';
import type { ModelItem } from '../model-selector.js';
import { makeCustomModelItem, ModelSelectorComponent } from '../model-selector.js';

const models: ModelItem[] = [
  {
    id: 'anthropic/claude-sonnet-4',
    provider: 'anthropic',
    modelName: 'claude-sonnet-4',
    hasApiKey: false,
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'openrouter/anthropic/claude-sonnet-4',
    provider: 'openrouter',
    modelName: 'anthropic/claude-sonnet-4',
    hasApiKey: true,
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
  },
];

describe('makeCustomModelItem', () => {
  it('derives hasApiKey/apiKeyEnvVar from a sibling model with the same provider when no key is configured', () => {
    const item = makeCustomModelItem('anthropic/claude-sonnet-5', models);
    expect(item).toEqual({
      id: 'anthropic/claude-sonnet-5',
      provider: 'anthropic',
      modelName: 'claude-sonnet-5',
      hasApiKey: false,
      apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    });
  });

  it('derives hasApiKey/apiKeyEnvVar from a sibling model with the same provider when a key is configured', () => {
    const item = makeCustomModelItem('openrouter/totally/made-up', models);
    expect(item).toEqual({
      id: 'openrouter/totally/made-up',
      provider: 'openrouter',
      modelName: 'totally/made-up',
      hasApiKey: true,
      apiKeyEnvVar: 'OPENROUTER_API_KEY',
    });
  });

  it('falls back to hasApiKey: false with no env var when no sibling provider exists', () => {
    const item = makeCustomModelItem('fakeprovider/totally-not-real', models);
    expect(item).toEqual({
      id: 'fakeprovider/totally-not-real',
      provider: 'fakeprovider',
      modelName: 'totally-not-real',
      hasApiKey: false,
      apiKeyEnvVar: undefined,
    });
  });

  it('treats a bare id without slash as provider="custom" and falls back to hasApiKey: false', () => {
    const item = makeCustomModelItem('weird-id', models);
    expect(item).toEqual({
      id: 'weird-id',
      provider: 'custom',
      modelName: 'weird-id',
      hasApiKey: false,
      apiKeyEnvVar: undefined,
    });
  });

  it('selects an unmatched bare model id', () => {
    const onSelect = vi.fn();
    const selector = new ModelSelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      models,
      onSelect,
      onCancel: vi.fn(),
    });

    const frame = new MenuFrame(selector);

    for (const character of 'unmatched-bare-id') frame.handleInput(character);

    expect(
      selector
        .render(100)
        .map(line => stripAnsi(line))
        .join('\n'),
    ).toContain('Use: unmatched-bare-id');
    selector.handleInput('\r');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'unmatched-bare-id' }));
  });
});

describe('MastraCode gateway catalog models', () => {
  const customProviderModels: ModelItem[] = ['gemma-4-31b', 'gemma-4-9b'].map(modelName => ({
    id: `mastracode/acme-local/${modelName}`,
    provider: 'mastracode/acme-local',
    modelName,
    hasApiKey: true,
  }));

  function createSelector(catalog: ModelItem[]) {
    const onSelect = vi.fn();
    const selector = new ModelSelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      models: catalog,
      onSelect,
      onCancel: vi.fn(),
    });
    const screen = () =>
      selector
        .render(100)
        .map(line => stripAnsi(line))
        .join('\n');
    return { selector, onSelect, screen };
  }

  it('lists and selects a typed custom provider model under its canonical id', () => {
    const { selector, onSelect, screen } = createSelector([...models, ...customProviderModels]);

    const frame = new MenuFrame(selector);

    for (const character of 'acme-local/gemma-4-31b') frame.handleInput(character);

    expect(screen()).not.toContain('Use: acme-local/gemma-4-31b');
    expect(screen()).not.toContain('mastracode/');
    expect(screen()).toContain('→ acme-local/gemma-4-31b');
    selector.handleInput('\r');
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acme-local/gemma-4-31b', provider: 'acme-local' }),
    );
  });

  it('keeps the authenticated entry when a canonical id is listed twice', () => {
    const { selector, onSelect } = createSelector([
      { id: 'ollama/llama-4', provider: 'ollama', modelName: 'llama-4', hasApiKey: false },
      { id: 'mastracode/ollama/llama-4', provider: 'mastracode/ollama', modelName: 'llama-4', hasApiKey: true },
    ]);

    const frame = new MenuFrame(selector);

    for (const character of 'ollama/llama-4') frame.handleInput(character);
    selector.handleInput('\r');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ollama/llama-4', provider: 'ollama', hasApiKey: true }),
    );
  });

  it('saves a typed id that matches no catalog row exactly as typed', () => {
    const { selector, onSelect, screen } = createSelector([...models, ...customProviderModels]);

    const frame = new MenuFrame(selector);

    for (const character of 'acme-local/gemma-5') frame.handleInput(character);

    expect(screen()).toContain('Use: acme-local/gemma-5');
    selector.handleInput('\r');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'acme-local/gemma-5' }));
  });
});
