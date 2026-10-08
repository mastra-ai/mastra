import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AgentViewNavigation } from '../agent-view-navigation';
import { systemPackages } from './fixtures/channels';
import { Link } from '@/lib/link';
import { draftAuthDisabled } from '@/pages/agents/agent/__tests__/fixtures/drafts';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const enabledPackages = { ...systemPackages, cmsEnabled: true, observabilityEnabled: true };

function renderNavigation(path = '/agents/agent-1/overview', agentId = 'agent-1') {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(draftAuthDisabled)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <TooltipProvider>
            <Sidebar.Provider LinkComponent={Link}>
              <AgentViewNavigation agentId={agentId} />
            </Sidebar.Provider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
  return client;
}

afterEach(cleanup);

describe('AgentViewNavigation', () => {
  describe('when editor and observability are available', () => {
    it('exposes Overview, Configuration, Editor, Metrics and Traces as agent-scoped links', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(enabledPackages)));
      renderNavigation();
      const editor = await screen.findByRole('link', { name: 'Editor' });
      expect(editor.getAttribute('href')).toBe('/agents/agent-1/editor');
      expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('link', { name: 'Traces' }).getAttribute('href')).toBe('/agents/agent-1/traces');
      expect(screen.getByRole('link', { name: 'Metrics' }).getAttribute('href')).toBe('/agents/agent-1/metrics');
      expect(screen.getByRole('link', { name: 'Configuration' }).getAttribute('href')).toBe(
        '/agents/agent-1/configuration',
      );
      expect(screen.queryByRole('link', { name: 'Chat' })).toBeNull();
    });
    it('marks the Editor route as current', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(enabledPackages)));
      renderNavigation('/agents/agent-1/editor');
      expect((await screen.findByRole('link', { name: 'Editor' })).getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
    });
    it('uses the view segment even when the agent id is editor', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(enabledPackages)));
      renderNavigation('/agents/editor/overview', 'editor');
      await screen.findByRole('link', { name: 'Editor' });
      expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('link', { name: 'Editor' }).getAttribute('aria-current')).toBeNull();
    });
  });
  describe('when editor and observability are unavailable', () => {
    it('keeps the unavailable features disabled', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)));
      server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(draftAuthDisabled)));
      const client = renderNavigation();
      await waitFor(() => expect(client.getQueryState(['mastra-packages'])?.status).toBe('success'));
      expect(screen.getByRole('button', { name: 'Editor' }).getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByRole('button', { name: 'Traces' }).getAttribute('aria-disabled')).toBe('true');
      const tracesControl = screen.getByRole('button', { name: 'Traces' });
      expect(tracesControl.querySelector('button')?.disabled).toBe(true);
      expect(tracesControl.querySelector('button')?.textContent).toContain('Traces');
      expect(screen.queryByRole('link', { name: 'Editor' })).toBeNull();
    });
    it('preserves the Editor explanation and documentation link', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)));
      renderNavigation();
      fireEvent.focus(await screen.findByRole('button', { name: 'Editor' }));
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('Add @mastra/editor');
      expect(within(tooltip).getByRole('link', { name: 'Learn more' }).getAttribute('href')).toBe(
        'https://mastra.ai/docs/editor/overview',
      );
    });
  });
});
