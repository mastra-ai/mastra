// @vitest-environment jsdom
import type { BuilderModelPolicy } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModelPolicyProvider } from '../context/model-policy-provider';
import { useLLMProviders } from '../hooks/use-llm-providers';
import { useModelPolicy } from '../hooks/use-model-policy';
import { useBuilderFilteredProviders } from '@/domains/builder';

const builderPolicy: BuilderModelPolicy = {
  active: true,
  pickerVisible: true,
  allowed: [{ provider: 'openai' }],
};

const inactivePolicy: BuilderModelPolicy = { active: false };

const getModelPolicy = vi.fn<(args: { surface: 'builder' | 'editor' }) => Promise<BuilderModelPolicy>>();

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({
    getModelPolicy: (args: { surface: 'builder' | 'editor' }) => getModelPolicy(args),
    listAgentsModelProviders: async () => ({
      providers: [
        { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-5-mini'] },
        {
          id: 'anthropic',
          name: 'Anthropic',
          envVar: 'ANTHROPIC_API_KEY',
          connected: true,
          models: ['claude-opus-4-7'],
        },
      ],
    }),
  }),
}));

// Mirrors what LLMProviders does internally: reads useModelPolicy() and
// applies useBuilderFilteredProviders to the listed providers. We probe the
// resulting set instead of opening the Combobox portal in JSDOM.
const ProvidersProbe = () => {
  const { data } = useLLMProviders();
  const policy = useModelPolicy();
  const providers = (data?.providers ?? []) as Parameters<typeof useBuilderFilteredProviders>[0];
  const filtered = useBuilderFilteredProviders(providers, policy);
  return <div data-testid="probe">{filtered.map(p => p.name).join(',')}</div>;
};

const renderWithClient = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  cleanup();
  getModelPolicy.mockReset();
});

describe('LLMProviders surface-scoped policy', () => {
  it('filters providers under builder surface with active allowlist', async () => {
    getModelPolicy.mockResolvedValue(builderPolicy);

    renderWithClient(
      <ModelPolicyProvider surface="builder">
        <ProvidersProbe />
      </ModelPolicyProvider>,
    );

    await waitFor(() => expect(getModelPolicy).toHaveBeenCalledWith({ surface: 'builder' }));
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('OpenAI'));
  });

  it('does NOT filter providers under editor surface (inactive policy)', async () => {
    getModelPolicy.mockResolvedValue(inactivePolicy);

    renderWithClient(
      <ModelPolicyProvider surface="editor">
        <ProvidersProbe />
      </ModelPolicyProvider>,
    );

    await waitFor(() => expect(getModelPolicy).toHaveBeenCalledWith({ surface: 'editor' }));
    await waitFor(() => {
      const text = screen.getByTestId('probe').textContent ?? '';
      expect(text).toContain('OpenAI');
      expect(text).toContain('Anthropic');
    });
  });

  it('does NOT filter when no ModelPolicyProvider is mounted', async () => {
    renderWithClient(<ProvidersProbe />);

    await waitFor(() => {
      const text = screen.getByTestId('probe').textContent ?? '';
      expect(text).toContain('OpenAI');
      expect(text).toContain('Anthropic');
    });
    expect(getModelPolicy).not.toHaveBeenCalled();
  });
});
