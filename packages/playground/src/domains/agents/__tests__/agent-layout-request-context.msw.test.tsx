// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentLayout } from '../agent-layout';
import { emptyPlatforms } from '../components/__tests__/fixtures/channels';
import { v2Agent } from '../components/__tests__/fixtures/composer-model-settings';
import { usePlaygroundModel } from '../context/playground-model-context';
import { paths } from '@/lib/app-routing';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
function ModelProbe() {
  const { model } = usePlaygroundModel();
  return <output>{model}</output>;
}
function renderLayout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/agents/:agentId/threads/new',
        element: (
          <KeyboardShortcutsProvider>
            <AgentLayout>
              <ModelProbe />
            </AgentLayout>
          </KeyboardShortcutsProvider>
        ),
      },
    ],
    { initialEntries: ['/agents/agent-1/threads/new'] },
  );
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <LinkComponentProvider Link={Link} navigate={to => void router.navigate(to)} paths={paths}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function installHandlers() {
  const contexts: unknown[] = [];
  localStorage.setItem('mastra:request-context:agent:agent-1', JSON.stringify({ locale: 'fr' }));
  server.use(
    http.get(`${BASE_URL}/api/agents/agent-1`, ({ request }) => {
      const encoded = new URL(request.url).searchParams.get('requestContext');
      const context = encoded ? JSON.parse(atob(encoded)) : {};
      contexts.push(context);
      return HttpResponse.json({
        ...v2Agent,
        modelId: context.locale === 'fr' ? 'contextual-model' : 'fallback-model',
      });
    }),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
  );
  return contexts;
}
describe('AgentLayout request context', () => {
  describe('when the agent has persisted context', () => {
    it('sends the saved context on every details request including the first', async () => {
      const contexts = installHandlers();
      renderLayout();
      await screen.findByText(/contextual-model|fallback-model/);
      expect(
        contexts.length > 0 && contexts.every(context => JSON.stringify(context) === JSON.stringify({ locale: 'fr' })),
      ).toBe(true);
    });
    it('uses the context-dependent model as the default', async () => {
      installHandlers();
      renderLayout();
      expect(await screen.findByText('contextual-model')).not.toBeNull();
    });
  });
});
