// @vitest-environment jsdom
import type { BuilderModelPolicy, Provider } from '@mastra/client-js';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '../../../llm/hooks/use-filtered-models';
import { useBuilderFilteredModels, useBuilderFilteredProviders } from '../use-builder-filtered-models';

const providers: Provider[] = [
  { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
  {
    id: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    connected: true,
    models: ['claude-opus-4-7', 'claude-haiku-4-5'],
  },
  {
    id: 'acme/gateway',
    name: 'Acme Gateway',
    envVar: 'ACME_API_KEY',
    connected: false,
    models: ['acme-mini'],
  },
];

const allModels: ModelInfo[] = providers.flatMap(p =>
  p.models.map(model => ({ provider: p.id, providerName: p.name, model })),
);

describe('useBuilderFilteredProviders', () => {
  it('passes through when policy is inactive', () => {
    const policy: BuilderModelPolicy = { active: false };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toEqual(providers);
  });

  it('passes through when allowed is undefined', () => {
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toEqual(providers);
  });

  it('passes through when allowed is empty (matches server-side contract)', () => {
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true, allowed: [] };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toEqual(providers);
  });

  it('keeps providers with at least one allowed model (provider wildcard)', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('openai');
    expect(result.current[0].models).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('narrows models within a provider when modelId is specified', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].models).toEqual(['gpt-4o-mini']);
  });

  it('keeps custom-kind providers verbatim', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ kind: 'custom', provider: 'acme/gateway' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('acme/gateway');
  });

  it('returns empty when allowed list has only unknown non-custom providers', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'made-up' as 'openai' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toEqual([]);
  });

  it('combines provider wildcard with specific modelId narrowing for the same allowlist', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy));
    expect(result.current).toHaveLength(2);
    expect(result.current.map(p => p.id)).toEqual(['openai', 'anthropic']);
    const openai = result.current.find(p => p.id === 'openai');
    const anthropic = result.current.find(p => p.id === 'anthropic');
    expect(openai?.models).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(anthropic?.models).toEqual(['claude-opus-4-7']);
    expect(result.current.find(p => p.id === 'acme/gateway')).toBeUndefined();
  });
});

describe('useBuilderFilteredModels', () => {
  it('passes through when policy is inactive', () => {
    const policy: BuilderModelPolicy = { active: false };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy));
    expect(result.current).toEqual(allModels);
  });

  it('passes through when allowed is undefined', () => {
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy));
    expect(result.current).toEqual(allModels);
  });

  it('intersects with allowlist (provider wildcard)', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }],
    };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy));
    expect(result.current.map(m => m.model)).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('intersects with allowlist (specific modelId)', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'anthropic', modelId: 'claude-opus-4-7' }],
    };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy));
    expect(result.current).toEqual([{ provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' }]);
  });

  it('intersects with combined provider-wildcard + specific-modelId allowlist', () => {
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
    };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy));
    expect(result.current).toEqual([
      { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
      { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' },
      { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' },
    ]);
    expect(result.current.find(m => m.model === 'claude-haiku-4-5')).toBeUndefined();
    expect(result.current.find(m => m.model === 'acme-mini')).toBeUndefined();
  });
});
