// @vitest-environment jsdom
import type { BuilderAvailableModelsResponse } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Base UI's Checkbox synthesizes a PointerEvent on click, which jsdom does not
// implement; alias it to MouseEvent so click handlers run.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Models } from '../models';

vi.mock('@/domains/agent-builder', () => ({
  useBuilderModelPolicy: () => ({ active: false, pickerVisible: true }),
}));

vi.mock('@/domains/llm', () => ({
  cleanProviderId: (provider: string) => provider,
  ProviderLogo: ({ providerId }: { providerId: string }) => <span data-testid={`provider-logo-${providerId}`} />,
  useAllModels: () => [
    { provider: 'openai', providerName: 'OpenAI', model: 'gpt-4o' },
    { provider: 'anthropic', providerName: 'Anthropic', model: 'claude-3-5-sonnet' },
  ],
}));

vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({
    getBuilderAvailableModels: async (): Promise<BuilderAvailableModelsResponse> => ({ providers: [] }),
  }),
}));

const FormHarness = ({ agentId = 'agent_test', children }: { agentId?: string; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      model: { provider: 'openai', name: 'gpt-4o' },
    } as AgentBuilderEditFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seed the available-models query so the picker renders synchronously.
  queryClient.setQueryData(['builder-available-models'], { providers: [] });
  return (
    <QueryClientProvider client={queryClient}>
      <FormProvider {...methods}>
        <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
      </FormProvider>
    </QueryClientProvider>
  );
};

describe('Models', () => {
  afterEach(() => {
    cleanup();
  });

  it('paints the selected model container and check cell with border-based HSL when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
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

  it('leaves unselected model borders untouched while using agent color for focus when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
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

  it('renders an uppercase text-neutral3 section title per provider, grouping cards under each', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const openaiTitle = getByTestId('model-provider-section-title-openai');
    expect(openaiTitle.textContent).toBe('OpenAI');
    expect(openaiTitle.className).toContain('text-neutral3');
    expect(openaiTitle.className).toContain('uppercase');
    expect(openaiTitle.className).toContain('text-ui-sm');

    const anthropicTitle = getByTestId('model-provider-section-title-anthropic');
    expect(anthropicTitle.textContent).toBe('Anthropic');

    const openaiSection = getByTestId('model-provider-section-openai');
    const openaiCard = getByTestId('model-card-openai-gpt-4o');
    const anthropicCard = getByTestId('model-card-anthropic-claude-3-5-sonnet');
    expect(openaiSection.contains(openaiCard)).toBe(true);
    expect(openaiSection.contains(anthropicCard)).toBe(false);
  });

  it('renders one provider filter row per provider, all checked by default', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const openaiRow = getByTestId('models-provider-filter-item-openai');
    const anthropicRow = getByTestId('models-provider-filter-item-anthropic');
    expect(openaiRow).toBeTruthy();
    expect(anthropicRow).toBeTruthy();

    const openaiCheckbox = getByTestId('models-provider-filter-checkbox-openai');
    const anthropicCheckbox = getByTestId('models-provider-filter-checkbox-anthropic');
    expect(openaiCheckbox.getAttribute('aria-checked')).toBe('true');
    expect(anthropicCheckbox.getAttribute('aria-checked')).toBe('true');
  });

  it('unchecking a provider hides that provider section and cards', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));

    expect(queryByTestId('model-provider-section-anthropic')).toBeNull();
    expect(queryByTestId('model-card-anthropic-claude-3-5-sonnet')).toBeNull();
    expect(queryByTestId('model-provider-section-openai')).toBeTruthy();
    expect(queryByTestId('model-card-openai-gpt-4o')).toBeTruthy();
  });

  it('re-checking a provider restores it', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const anthropicCheckbox = getByTestId('models-provider-filter-checkbox-anthropic');
    fireEvent.click(anthropicCheckbox);
    expect(queryByTestId('model-provider-section-anthropic')).toBeNull();

    fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));
    expect(queryByTestId('model-provider-section-anthropic')).toBeTruthy();
    expect(queryByTestId('model-card-anthropic-claude-3-5-sonnet')).toBeTruthy();
  });

  it('Clear all hides every provider section and shows the empty-state copy', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('models-provider-filter-clear-all'));

    expect(queryByTestId('model-provider-section-openai')).toBeNull();
    expect(queryByTestId('model-provider-section-anthropic')).toBeNull();
    expect(getByText('Select at least one provider to see models')).toBeTruthy();
  });

  it('Select all restores every provider section after clearing', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('models-provider-filter-clear-all'));
    expect(queryByTestId('model-provider-section-openai')).toBeNull();

    fireEvent.click(getByTestId('models-provider-filter-select-all'));
    expect(queryByTestId('model-provider-section-openai')).toBeTruthy();
    expect(queryByTestId('model-provider-section-anthropic')).toBeTruthy();
  });

  it('left-pane search filters the provider checklist without affecting the model grid', async () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const filterSearch = getByTestId('models-provider-filter-search').querySelector('input');
    expect(filterSearch).toBeTruthy();
    fireEvent.change(filterSearch!, { target: { value: 'anthropic' } });

    await waitFor(() => expect(queryByTestId('models-provider-filter-item-openai')).toBeNull());
    expect(queryByTestId('models-provider-filter-item-anthropic')).toBeTruthy();

    // Model grid is unaffected by the left-pane search.
    expect(queryByTestId('model-provider-section-openai')).toBeTruthy();
    expect(queryByTestId('model-card-openai-gpt-4o')).toBeTruthy();
  });

  it('paints the checked provider checkbox with agent color when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    const checkbox = getByTestId('models-provider-filter-checkbox-openai') as HTMLButtonElement;
    expect(checkbox.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(checkbox.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(checkbox.className).not.toContain('bg-accent1');
  });

  it('combines provider filter and search: searching for a hidden provider yields the search empty state', async () => {
    const { getByTestId, findByText } = render(
      <FormHarness>
        <Models />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));

    const searchInput = getByTestId('model-card-picker-search').querySelector('input');
    expect(searchInput).toBeTruthy();
    fireEvent.change(searchInput!, { target: { value: 'claude' } });

    await findByText('No models match "claude"');
  });
});
