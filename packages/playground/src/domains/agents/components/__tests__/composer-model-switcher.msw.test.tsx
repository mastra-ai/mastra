// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { PlaygroundModelProvider } from '../../context/playground-model-context';
import { ComposerModelSwitcher } from '../composer-model-switcher';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const createGate = () => {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });

  return { promise, release };
};

const useHandlers = (providersGate: Promise<void>) => {
  server.use(
    http.get(`${BASE_URL}/api/agents/providers`, async () => {
      await providersGate;
      return HttpResponse.json({ providers: [] });
    }),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () =>
      HttpResponse.json({ enabled: false, modelPolicy: { active: false } }),
    ),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
  );
};

const renderSwitcher = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <PlaygroundModelProvider>
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
      useHandlers(providersGate.promise);
      renderSwitcher();

      expect(await screen.findByTestId('composer-model-switcher-skeleton')).not.toBeNull();
      expect(screen.queryByText('Select provider...')).toBeNull();

      providersGate.release();

      await waitFor(() => expect(screen.getByText('Select provider...')).not.toBeNull());
      expect(screen.queryByTestId('composer-model-switcher-skeleton')).toBeNull();
    });
  });
});
