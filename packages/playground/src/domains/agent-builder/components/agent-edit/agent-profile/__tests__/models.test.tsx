import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
import { buildAvailableModels, buildBuilderSettings } from './fixtures/builder';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

/**
 * Backs the real picker data flow: `useBuilderModelPolicy` reads builder
 * settings (no `modelPolicy` ⇒ inactive ⇒ picker not locked) and
 * `useAgentBuilderAllowedModels` fetches the server-filtered model list.
 */
const registerModelHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(buildBuilderSettings())),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json(buildAvailableModels())),
  );
};

const FormHarness = ({ agentId = 'agent_test', children }: { agentId?: string; children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      model: { provider: 'openai', name: 'gpt-4o' },
    } as AgentBuilderEditFormValues,
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>
          <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
        </FormProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

/** Renders the picker and waits for the allowed-models query to resolve. */
const renderModels = async () => {
  const utils = render(
    <FormHarness>
      <Models />
    </FormHarness>,
  );
  await utils.findByTestId('model-card-picker');
  return utils;
};

describe('Models', () => {
  beforeEach(() => {
    registerModelHandlers();
  });

  afterEach(() => {
    cleanup();
  });

  describe('when an agentId is provided', () => {
    it('paints the selected model container with border-based HSL and no accent classes', async () => {
      const { getByTestId } = await renderModels();

      const container = getByTestId('model-card-openai-gpt-4o') as HTMLButtonElement;
      expect(container.style.borderColor).toMatch(/^(rgb|hsl)\(/);
      expect(container.style.boxShadow).toBe('');
      expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
      expect(container.className).not.toContain('border-accent1');
      expect(container.className).not.toContain('ring-1 ring-accent1');
      expect(container.className).not.toContain('focus-visible:ring');
    });

    it('paints the selected model check cell with border-based HSL', async () => {
      const { getByTestId } = await renderModels();

      const check = getByTestId('model-card-check-openai-gpt-4o') as HTMLSpanElement;
      expect(check.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
      expect(check.style.borderColor).toMatch(/^(rgb|hsl)\(/);
      expect(check.className).not.toContain('bg-accent1');
    });

    it('leaves unselected model borders untouched while using agent color for focus', async () => {
      const { getByTestId } = await renderModels();

      const container = getByTestId('model-card-anthropic-claude-3-5-sonnet') as HTMLButtonElement;
      expect(container.style.getPropertyValue('--agent-color-bg')).toMatch(/^hsl\(/);
      expect(container.style.borderColor).toBe('');
      expect(container.className).toContain('border-border1');
      expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
      expect(container.className).not.toContain('focus-visible:ring');
    });

    it('paints the checked provider checkbox with agent color', async () => {
      const { getByTestId } = await renderModels();

      const checkbox = getByTestId('models-provider-filter-checkbox-openai') as HTMLButtonElement;
      expect(checkbox.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
      expect(checkbox.style.borderColor).toMatch(/^(rgb|hsl)\(/);
      expect(checkbox.className).not.toContain('bg-accent1');
    });
  });

  describe('when rendering the model grid', () => {
    it('renders an uppercase text-neutral3 section title per provider', async () => {
      const { getByTestId } = await renderModels();

      const openaiTitle = getByTestId('model-provider-section-title-openai');
      expect(openaiTitle.textContent).toBe('OpenAI');
      expect(openaiTitle.className).toContain('text-neutral3');
      expect(openaiTitle.className).toContain('uppercase');
      expect(openaiTitle.className).toContain('text-ui-sm');

      const anthropicTitle = getByTestId('model-provider-section-title-anthropic');
      expect(anthropicTitle.textContent).toBe('Anthropic');
    });

    it('groups each provider card under its own section', async () => {
      const { getByTestId } = await renderModels();

      const openaiSection = getByTestId('model-provider-section-openai');
      const openaiCard = getByTestId('model-card-openai-gpt-4o');
      const anthropicCard = getByTestId('model-card-anthropic-claude-3-5-sonnet');
      expect(openaiSection.contains(openaiCard)).toBe(true);
      expect(openaiSection.contains(anthropicCard)).toBe(false);
    });
  });

  describe('when rendering the provider filter', () => {
    it('renders one filter row per provider, all checked by default', async () => {
      const { getByTestId } = await renderModels();

      expect(getByTestId('models-provider-filter-item-openai')).toBeTruthy();
      expect(getByTestId('models-provider-filter-item-anthropic')).toBeTruthy();
      expect(getByTestId('models-provider-filter-checkbox-openai').getAttribute('aria-checked')).toBe('true');
      expect(getByTestId('models-provider-filter-checkbox-anthropic').getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('when a provider is unchecked', () => {
    it('hides that provider section and cards while keeping the others', async () => {
      const { getByTestId, queryByTestId } = await renderModels();

      fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));

      expect(queryByTestId('model-provider-section-anthropic')).toBeNull();
      expect(queryByTestId('model-card-anthropic-claude-3-5-sonnet')).toBeNull();
      expect(queryByTestId('model-provider-section-openai')).toBeTruthy();
      expect(queryByTestId('model-card-openai-gpt-4o')).toBeTruthy();
    });

    it('restores the provider when re-checked', async () => {
      const { getByTestId, queryByTestId } = await renderModels();

      fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));
      expect(queryByTestId('model-provider-section-anthropic')).toBeNull();

      fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));
      expect(queryByTestId('model-provider-section-anthropic')).toBeTruthy();
      expect(queryByTestId('model-card-anthropic-claude-3-5-sonnet')).toBeTruthy();
    });
  });

  describe('when using Clear all / Select all', () => {
    it('Clear all hides every provider section and shows the empty-state copy', async () => {
      const { getByTestId, getByText, queryByTestId } = await renderModels();

      fireEvent.click(getByTestId('models-provider-filter-clear-all'));

      expect(queryByTestId('model-provider-section-openai')).toBeNull();
      expect(queryByTestId('model-provider-section-anthropic')).toBeNull();
      expect(getByText('Select at least one provider to see models')).toBeTruthy();
    });

    it('Select all restores every provider section after clearing', async () => {
      const { getByTestId, queryByTestId } = await renderModels();

      fireEvent.click(getByTestId('models-provider-filter-clear-all'));
      expect(queryByTestId('model-provider-section-openai')).toBeNull();

      fireEvent.click(getByTestId('models-provider-filter-select-all'));
      expect(queryByTestId('model-provider-section-openai')).toBeTruthy();
      expect(queryByTestId('model-provider-section-anthropic')).toBeTruthy();
    });
  });

  describe('when searching', () => {
    it('the left-pane search filters the provider checklist without affecting the model grid', async () => {
      const { getByTestId, queryByTestId } = await renderModels();

      const filterSearch = getByTestId('models-provider-filter-search').querySelector('input');
      expect(filterSearch).toBeTruthy();
      fireEvent.change(filterSearch!, { target: { value: 'anthropic' } });

      await waitFor(() => expect(queryByTestId('models-provider-filter-item-openai')).toBeNull());
      expect(queryByTestId('models-provider-filter-item-anthropic')).toBeTruthy();

      // Model grid is unaffected by the left-pane search.
      expect(queryByTestId('model-provider-section-openai')).toBeTruthy();
      expect(queryByTestId('model-card-openai-gpt-4o')).toBeTruthy();
    });

    it('combines provider filter and search to yield the search empty state', async () => {
      const { getByTestId, findByText } = await renderModels();

      fireEvent.click(getByTestId('models-provider-filter-checkbox-anthropic'));

      const searchInput = getByTestId('model-card-picker-search').querySelector('input');
      expect(searchInput).toBeTruthy();
      fireEvent.change(searchInput!, { target: { value: 'claude' } });

      await findByText('No models match "claude"');
    });
  });
});
