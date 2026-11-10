// @vitest-environment jsdom
import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { PlaygroundModelProvider } from '../../context/playground-model-context';
import { ComposerModelSwitcher } from '../composer-model-switcher';
import { openAiProviders } from './fixtures/composer-model-switcher';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createGate = () => {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });

  return { promise, release };
};

const mockProviderRequests = (
  providersGate: Promise<void>,
  providers: ListAgentsModelProvidersResponse = { providers: [] },
) => {
  server.use(
    http.get(`${BASE_URL}/api/agents/providers`, async () => {
      await providersGate;
      return HttpResponse.json(providers);
    }),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
  );
};

const renderSwitcher = (agentModel?: { provider: string; model: string }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <PlaygroundModelProvider defaultProvider={agentModel?.provider} defaultModel={agentModel?.model}>
              <ComposerModelSwitcher />
            </PlaygroundModelProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('ComposerModelSwitcher', () => {
  describe('when the providers request is still in flight', () => {
    it('reserves the picker footprint with a skeleton until providers resolve', async () => {
      const providersGate = createGate();
      mockProviderRequests(providersGate.promise);
      renderSwitcher();

      expect(await screen.findByTestId('composer-model-switcher-skeleton')).not.toBeNull();
      expect(screen.queryByText('Select model')).toBeNull();

      providersGate.release();

      await waitFor(() => expect(screen.getByText('Select model')).not.toBeNull());
      expect(screen.queryByTestId('composer-model-switcher-skeleton')).toBeNull();
    });
  });

  describe('when the agent runs on a model from the catalog', () => {
    const openPicker = async () => {
      mockProviderRequests(Promise.resolve(), openAiProviders);
      renderSwitcher({ provider: 'openai', model: 'gpt-4o-mini' });
      fireEvent.click(await screen.findByRole('button', { name: /Model:.*GPT-4o Mini/ }));
      return screen.findByRole('listbox');
    };

    it("marks the agent's model as the default", async () => {
      const list = await openPicker();

      const option = within(list).getByRole('option', { name: /GPT-4o Mini/ });
      expect(within(option).getByText('Default')).not.toBeNull();
    });

    it("offers no reset while the agent's model is picked", async () => {
      await openPicker();

      expect(screen.queryByRole('option', { name: /Reset to the agent's model/ })).toBeNull();
    });

    it("resets to the agent's model after another one is picked", async () => {
      const list = await openPicker();
      fireEvent.click(within(list).getByRole('option', { name: /GPT-5/ }));
      await screen.findByRole('button', { name: /Model:.*GPT-5/ });

      fireEvent.click(screen.getByRole('button', { name: /Model:.*GPT-5/ }));
      fireEvent.click(await screen.findByRole('option', { name: /Reset to the agent's model/ }));

      expect(await screen.findByRole('button', { name: /Model:.*GPT-4o Mini/ })).not.toBeNull();
    });
  });
});
