import type { TUI } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';
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
  {
    id: 'opencode/x-preview-f-free',
    provider: 'opencode',
    modelName: 'x-preview-f-free',
    hasApiKey: false,
    apiKeyEnvVar: 'OPENCODE_API_KEY',
    noKeyNeeded: true,
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

  it('derives noKeyNeeded from an exact id match before falling back to the provider sibling', () => {
    const item = makeCustomModelItem('opencode/x-preview-f-free', models);
    expect(item.noKeyNeeded).toBe(true);

    const paidItem = makeCustomModelItem('opencode/gpt-5.6-sol', models);
    expect(paidItem.hasApiKey).toBe(false);
    expect(paidItem.apiKeyEnvVar).toBe('OPENCODE_API_KEY');
  });
});

describe('ModelSelectorComponent free-model display', () => {
  function renderLines(items: ModelItem[]): string[] {
    const selector = new ModelSelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      models: items,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });
    return selector.render(100).map(line => stripAnsi(line));
  }

  it('marks keyless free models as (free) instead of missing a key, and sorts them as usable', () => {
    const lines = renderLines(models).join('\n');

    expect(lines).toContain('opencode/x-preview-f-free (free)');
    expect(lines).not.toContain('opencode/x-preview-f-free ✗');

    // Usable models sort ahead of keyless paid ones; among usable, providers
    // are alphabetical (opencode < openrouter).
    expect(lines.indexOf('opencode/x-preview-f-free')).toBeLessThan(
      lines.indexOf('openrouter/anthropic/claude-sonnet-4'),
    );
    expect(lines.indexOf('openrouter/anthropic/claude-sonnet-4')).toBeLessThan(
      lines.indexOf('anthropic/claude-sonnet-4 ✗'),
    );
  });

  it('still flags keyless paid models as missing their env var', () => {
    const lines = renderLines(models).join('\n');

    expect(lines).toContain('anthropic/claude-sonnet-4 ✗ (ANTHROPIC_API_KEY)');
  });
});
