// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Models } from '../models';

vi.mock('@/domains/builder', () => ({
  useBuilderModelPolicy: () => ({ active: false, pickerVisible: true }),
  useBuilderFilteredProviders: (providers: unknown) => providers,
  useBuilderFilteredModels: (models: unknown) => models,
}));

vi.mock('@/domains/llm', () => ({
  cleanProviderId: (provider: string) => provider,
  ProviderLogo: ({ providerId }: { providerId: string }) => <span data-testid={`provider-logo-${providerId}`} />,
  useAllModels: () => [
    { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
    { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-3-5-sonnet' },
  ],
  useLLMProviders: () => ({
    isLoading: false,
    data: {
      providers: [
        { id: 'openai', name: 'OpenAI', label: 'OpenAI', description: '', models: ['gpt-4o'] },
        { id: 'anthropic', name: 'Anthropic', label: 'Anthropic', description: '', models: ['claude-3-5-sonnet'] },
      ],
    },
  }),
}));

const FormHarness = ({ agentName = '', children }: { agentName?: string; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: agentName,
      model: { provider: 'openai', name: 'gpt-4o' },
    } as AgentBuilderEditFormValues,
  });
  return (
    <FormProvider {...methods}>
      <AgentColorProvider>{children}</AgentColorProvider>
    </FormProvider>
  );
};

describe('Models', () => {
  afterEach(() => {
    cleanup();
  });

  it('paints the selected model container and check cell with border-based HSL when a name is set', () => {
    const { getByTestId } = render(
      <FormHarness agentName="Support agent">
        <Models />
      </FormHarness>,
    );

    const container = getByTestId('model-card-openai-gpt-4o') as HTMLButtonElement;
    const check = getByTestId('model-card-check-openai-gpt-4o') as HTMLSpanElement;

    expect(container.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(container.style.boxShadow).toBe('');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('border-accent1');
    expect(container.className).not.toContain('ring-1 ring-accent1');
    expect(container.className).not.toContain('focus-visible:ring');

    expect(check.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(check.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(check.className).not.toContain('bg-accent1');
  });

  it('falls back to accent classes for selected models when no agent name is set', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const container = getByTestId('model-card-openai-gpt-4o') as HTMLButtonElement;
    const check = getByTestId('model-card-check-openai-gpt-4o') as HTMLSpanElement;

    expect(container.getAttribute('style')).toBeNull();
    expect(container.className).toContain('border-accent1');
    expect(container.className).toContain('ring-accent1');

    expect(check.getAttribute('style')).toBeNull();
    expect(check.className).toContain('border-accent1');
    expect(check.className).toContain('bg-accent1');
  });

  it('leaves unselected model borders untouched while using agent color for focus when a name is set', () => {
    const { getByTestId } = render(
      <FormHarness agentName="Support agent">
        <Models />
      </FormHarness>,
    );

    const container = getByTestId('model-card-anthropic-claude-3-5-sonnet') as HTMLButtonElement;
    expect(container.style.getPropertyValue('--agent-color-bg')).toMatch(/^hsl\(/);
    expect(container.style.borderColor).toBe('');
    expect(container.className).toContain('border-border1');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('focus-visible:ring');
  });
});
