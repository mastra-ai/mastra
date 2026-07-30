import { describe, expect, it } from 'vitest';
import { MastraError } from '../../error';
import { isProviderTool } from '../toolchecks';
import { createWebSearchProviderTool, isWebSearchTool, normalizeWebSearchProvider, webSearchTool } from './web-search';

describe('webSearchTool', () => {
  it('identifies only the web search sentinel', () => {
    expect(isWebSearchTool(webSearchTool)).toBe(true);
    expect(isWebSearchTool(null)).toBe(false);
    expect(isWebSearchTool({})).toBe(false);
    expect(isWebSearchTool(createWebSearchProviderTool('openai'))).toBe(false);
    expect(
      isWebSearchTool({
        id: 'web_search',
        description: 'custom web search',
        execute: async () => undefined,
      }),
    ).toBe(false);
  });

  it('normalizes direct providers and router strings', () => {
    expect(normalizeWebSearchProvider('openai')).toBe('openai');
    expect(normalizeWebSearchProvider('anthropic')).toBe('anthropic');
    expect(normalizeWebSearchProvider('google')).toBe('google');
    expect(normalizeWebSearchProvider('xai')).toBe('xai');
    expect(normalizeWebSearchProvider('openai/gpt-5-mini')).toBe('openai');
    expect(normalizeWebSearchProvider('anthropic/claude-sonnet-4-20250514')).toBe('anthropic');
    expect(normalizeWebSearchProvider('google/gemini-2.5-pro')).toBe('google');
    expect(normalizeWebSearchProvider('xai/grok-4')).toBe('xai');
  });

  it('normalizes openai-compatible models with supported router-style model ids', () => {
    expect(normalizeWebSearchProvider({ provider: 'openai-compatible', modelId: 'openai/gpt-5-mini' })).toBe('openai');
    expect(
      normalizeWebSearchProvider({ provider: 'openai-compatible', id: 'anthropic/claude-sonnet-4-20250514' }),
    ).toBe('anthropic');
  });

  it('throws for unsupported or ambiguous providers', () => {
    expect(() => normalizeWebSearchProvider('openai-compatible')).toThrow(MastraError);
    expect(() => normalizeWebSearchProvider('custom-provider/model')).toThrow(MastraError);
    expect(() => normalizeWebSearchProvider({ provider: 'openai-compatible', modelId: 'custom-model' })).toThrow(
      MastraError,
    );
  });

  it('creates provider-defined tools with provider-facing ids and model-facing names', () => {
    expect(createWebSearchProviderTool('openai')).toMatchObject({
      type: 'provider-defined',
      id: 'openai.web_search',
      name: 'web_search',
    });
    expect(createWebSearchProviderTool('anthropic')).toMatchObject({
      type: 'provider-defined',
      id: 'anthropic.web_search_20250305',
      name: 'web_search',
    });
    expect(createWebSearchProviderTool('google')).toMatchObject({
      type: 'provider-defined',
      id: 'google.google_search',
      name: 'google_search',
    });
    expect(createWebSearchProviderTool('xai')).toMatchObject({
      type: 'provider-defined',
      id: 'xai.web_search',
      name: 'web_search',
    });

    expect(isProviderTool(createWebSearchProviderTool('openai'))).toBe(true);
    expect(isProviderTool(createWebSearchProviderTool('anthropic'))).toBe(true);
    expect(isProviderTool(createWebSearchProviderTool('google'))).toBe(true);
    expect(isProviderTool(createWebSearchProviderTool('xai'))).toBe(true);
  });
});
