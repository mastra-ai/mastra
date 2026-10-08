import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudioRail } from '../studio-rail';
import { viewerSidebarCapabilities, adminSidebarCapabilities } from './fixtures/sidebar-permissions';
import { authHandler, BASE_URL, builderHandler, systemPackagesHandler } from './render-sidebar';
import { packagesWithPromptEditing } from '@/components/__tests__/fixtures/studio-shell';
import { RoleImpersonationProvider } from '@/domains/auth/context/role-impersonation-context';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

beforeEach(() => {
  window.localStorage.clear();
  server.use(
    authHandler({ enabled: false, login: { type: 'credentials' } }),
    builderHandler({ enabled: false }),
    systemPackagesHandler(),
  );
});
afterEach(cleanup);

function renderRail(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={client}>
        <RoleImpersonationProvider>
          <MemoryRouter initialEntries={[path]}>
            <TooltipProvider>
              <Sidebar.Provider defaultState="collapsed" LinkComponent={Link}>
                <StudioRail />
              </Sidebar.Provider>
            </TooltipProvider>
          </MemoryRouter>
        </RoleImpersonationProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('StudioRail', () => {
  describe('when viewing a conversation', () => {
    it('activates Chat without also activating Agents', async () => {
      renderRail('/agents/researcher/threads/thread-1');
      expect((await screen.findByRole('link', { name: 'Chat' })).getAttribute('aria-current')).toBe('page');
      expect(screen.getByRole('link', { name: 'Agents' }).getAttribute('aria-current')).toBeNull();
    });
  });
  describe('when visiting a workflow graph', () => {
    it('marks Build as the current destination', async () => {
      renderRail('/workflows/intake/graph');
      const rail = await screen.findByRole('complementary', { name: 'Studio navigation' });
      expect((await within(rail).findByRole('link', { name: 'Agents' })).getAttribute('aria-current')).toBe('page');
    });
    it('keeps search accessible in the icon rail', async () => {
      renderRail('/workflows/intake/graph');
      expect(await screen.findByRole('button', { name: 'Search and navigate' })).toBeTruthy();
    });
  });
  describe('when visiting a processor or tool', () => {
    it.each(['/processors/redactor', '/tools/weather'])(
      'marks the single Build destination active at %s',
      async path => {
        renderRail(path);
        expect((await screen.findByRole('link', { name: 'Agents' })).getAttribute('aria-current')).toBe('page');
        expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Processors' })).toBeNull();
      },
    );
  });
  describe('when visiting a task area', () => {
    it.each([
      ['/cms/prompts/create', 'Agents'],
      ['/cms/scorers/create', 'Evaluate'],
      ['/datasets/example/edit', 'Evaluate'],
      ['/experiments/review-queue', 'Evaluate'],
      ['/traces', 'Observe'],
      ['/logs', 'Observe'],
      ['/mcps/example', 'Connections'],
      ['/integrations', 'Connections'],
      ['/workspaces/example', 'Workspaces'],
    ])('keeps %s in the %s destination', async (path, destination) => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderRail(path);
      await waitFor(() =>
        expect(screen.getByRole('link', { name: destination }).getAttribute('aria-current')).toBe('page'),
      );
    });
    it('makes evaluation and observability visible without opening More', async () => {
      renderRail('/agents');
      for (const name of ['Agents', 'Evaluate', 'Observe', 'Connections', 'Workspaces']) {
        expect(await screen.findByRole('link', { name })).toBeTruthy();
      }
      expect(screen.queryByRole('link', { name: 'Scorers' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Logs' })).toBeNull();
    });
  });
  describe('when only logs are permitted', () => {
    it('opens logs directly from Observe without exposing unavailable areas', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['logs-user'], permissions: ['logs:read'] } }),
      );
      renderRail('/logs');
      expect((await screen.findByRole('link', { name: 'Observe' })).getAttribute('href')).toBe('/logs');
      expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Evaluate' })).toBeNull();
    });
  });
  describe('when only tool access is permitted', () => {
    it('opens the permitted collection from the Build area entry', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['tool-user'], permissions: ['tools:read'] } }),
      );
      renderRail('/tools');
      expect((await screen.findByRole('link', { name: 'Agents' })).getAttribute('href')).toBe('/tools');
    });
  });
  describe('when a viewer can only read agents and workflows', () => {
    it('excludes tools from the rail', async () => {
      server.use(authHandler(viewerSidebarCapabilities));
      renderRail('/agents');
      await screen.findByRole('link', { name: 'Agents' });
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    });
  });
});
