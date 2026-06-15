// @vitest-environment jsdom
import type { BuilderAvailableModelsResponse, BuilderModelPolicy, Provider } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelInfo } from '../../../llm/hooks/use-filtered-models';

const { getBuilderAvailableModels } = vi.hoisted(() => ({
  getBuilderAvailableModels: vi.fn(async (): Promise<BuilderAvailableModelsResponse> => ({ providers: [] })),
}));

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ getBuilderAvailableModels }),
}));

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

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: PropsWithChildren) => createElement(QueryClientProvider, { client: queryClient }, children);
};

/**
 * The allowed `provider:model` set comes from `GET /editor/builder/models/available`,
 * which the client surfaces as `getBuilderAvailableModels()`. The policy argument
 * only toggles pass-through; the actual membership is whatever the endpoint returns.
 */
const setAvailable = (available: Provider[]) => {
  getBuilderAvailableModels.mockResolvedValue({ providers: available });
};

beforeEach(() => {
  vi.clearAllMocks();
  getBuilderAvailableModels.mockResolvedValue({ providers: [] });
});

describe('useBuilderFilteredProviders', () => {
  it('passes through when policy is inactive', async () => {
    setAvailable([]);
    const policy: BuilderModelPolicy = { active: false };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    expect(result.current).toEqual(providers);
  });

  it('passes through when allowed is undefined', () => {
    setAvailable([]);
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    expect(result.current).toEqual(providers);
  });

  it('passes through when allowed is empty (matches server-side contract)', () => {
    setAvailable([]);
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true, allowed: [] };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    expect(result.current).toEqual(providers);
  });

  it('keeps providers with at least one model in the available set (provider wildcard)', async () => {
    setAvailable([
      { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
    ]);
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true, allowed: [{ provider: 'openai' }] };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe('openai');
    expect(result.current[0].models).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });

  it('narrows models within a provider to the available set', async () => {
    setAvailable([
      { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o-mini'] },
    ]);
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].models).toEqual(['gpt-4o-mini']);
  });

  it('keeps custom-kind providers present in the available set', async () => {
    setAvailable([
      { id: 'acme/gateway', name: 'Acme Gateway', envVar: 'ACME_API_KEY', connected: false, models: ['acme-mini'] },
    ]);
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ kind: 'custom', provider: 'acme/gateway' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe('acme/gateway');
  });

  it('returns empty when the available set excludes every provider', async () => {
    setAvailable([]);
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'made-up' as 'openai' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    await waitFor(() => expect(getBuilderAvailableModels).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('combines provider wildcard with specific modelId narrowing from the available set', async () => {
    setAvailable([
      { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
      { id: 'anthropic', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', connected: true, models: ['claude-opus-4-7'] },
    ]);
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
    };
    const { result } = renderHook(() => useBuilderFilteredProviders(providers, policy), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toHaveLength(2));
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
    setAvailable([]);
    const policy: BuilderModelPolicy = { active: false };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy), { wrapper: createWrapper() });
    expect(result.current).toEqual(allModels);
  });

  it('passes through when allowed is undefined', () => {
    setAvailable([]);
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy), { wrapper: createWrapper() });
    expect(result.current).toEqual(allModels);
  });

  it('intersects with the available set (provider wildcard)', async () => {
    setAvailable([
      { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
    ]);
    const policy: BuilderModelPolicy = { active: true, pickerVisible: true, allowed: [{ provider: 'openai' }] };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.map(m => m.model)).toEqual(['gpt-4o', 'gpt-4o-mini']));
  });

  it('intersects with the available set (specific modelId)', async () => {
    setAvailable([
      { id: 'anthropic', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', connected: true, models: ['claude-opus-4-7'] },
    ]);
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'anthropic', modelId: 'claude-opus-4-7' }],
    };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(result.current).toEqual([{ provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' }]),
    );
  });

  it('intersects with combined provider-wildcard + specific-modelId available set', async () => {
    setAvailable([
      { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
      { id: 'anthropic', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', connected: true, models: ['claude-opus-4-7'] },
    ]);
    const policy: BuilderModelPolicy = {
      active: true,
      pickerVisible: true,
      allowed: [{ provider: 'openai' }, { provider: 'anthropic', modelId: 'claude-opus-4-7' }],
    };
    const { result } = renderHook(() => useBuilderFilteredModels(allModels, policy), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(result.current).toEqual([
        { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
        { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o-mini' },
        { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-opus-4-7' },
      ]),
    );
    expect(result.current.find(m => m.model === 'claude-haiku-4-5')).toBeUndefined();
    expect(result.current.find(m => m.model === 'acme-mini')).toBeUndefined();
  });
});
