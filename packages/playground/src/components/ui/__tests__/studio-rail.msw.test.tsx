import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    it('marks Workflows as the current destination', async () => {
      renderRail('/workflows/intake/graph');
      const rail = await screen.findByRole('complementary', { name: 'Studio navigation' });
      expect((await within(rail).findByRole('link', { name: 'Workflows' })).getAttribute('aria-current')).toBe('page');
    });
    it('keeps search accessible in the icon rail', async () => {
      renderRail('/workflows/intake/graph');
      expect(await screen.findByRole('button', { name: 'Search and navigate' })).toBeTruthy();
    });
  });
  describe('when visiting a library page', () => {
    it.each([
      ['/processors/redactor', 'Processors'],
      ['/tools/weather', 'Tools'],
      ['/cms/prompts/create', 'Prompts'],
      ['/cms/scorers/create', 'Scorers'],
      ['/mcps/example', 'MCP Servers'],
      ['/workspaces/example', 'Workspaces'],
    ])('surfaces %s as the current %s page', async (path, name) => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderRail(path);
      await waitFor(() => expect(screen.getByRole('link', { name }).getAttribute('aria-current')).toBe('page'));
    });
    it('lists every library page in More instead of the rail', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderRail('/agents');
      fireEvent.click(await screen.findByRole('button', { name: 'More' }));
      for (const name of ['Prompts', 'Tools', 'Processors', 'Scorers', 'Workspaces', 'MCP Servers']) {
        expect(await screen.findByRole('menuitem', { name })).toBeTruthy();
        expect(screen.queryByRole('link', { name })).toBeNull();
      }
    });
  });
  describe('when visiting integrations', () => {
    it('marks the pinned Integrations entry current', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderRail('/integrations');
      expect((await screen.findByRole('link', { name: 'Integrations' })).getAttribute('aria-current')).toBe('page');
    });
  });
  describe('when visiting a task area', () => {
    it.each([
      ['/agents/researcher/overview', 'Agents'],
      ['/workflows/schedules', 'Workflows'],
      ['/datasets/example/edit', 'Evaluate'],
      ['/datasets/example/experiments', 'Evaluate'],
      ['/experiments/review-queue', 'Evaluate'],
      ['/traces', 'Traces'],
      ['/logs', 'Logs'],
      ['/metrics', 'Agents'],
    ])('keeps %s in the %s destination', async (path, destination) => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderRail(path);
      await waitFor(() =>
        expect(screen.getByRole('link', { name: destination }).getAttribute('aria-current')).toBe('page'),
      );
    });
    it('makes every product visible without opening More', async () => {
      renderRail('/agents');
      for (const name of ['Chat', 'Agents', 'Workflows', 'Traces', 'Evaluate', 'Logs']) {
        expect(await screen.findByRole('link', { name })).toBeTruthy();
      }
      expect(screen.queryByRole('link', { name: 'Scorers' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Metrics' })).toBeNull();
    });
  });
  describe('when only logs are permitted', () => {
    it('opens logs directly from Logs without exposing unavailable areas', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['logs-user'], permissions: ['logs:read'] } }),
      );
      renderRail('/logs');
      expect((await screen.findByRole('link', { name: 'Logs' })).getAttribute('href')).toBe('/logs');
      expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Traces' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Evaluate' })).toBeNull();
    });
  });
  describe('when only MCP server access is permitted', () => {
    it('offers permitted servers without requiring workspace access', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['mcp-user'], permissions: ['mcp:read'] } }),
      );
      renderRail('/mcps');
      expect((await screen.findByRole('link', { name: 'MCP Servers' })).getAttribute('href')).toBe('/mcps');
      expect(screen.queryByRole('link', { name: 'Workspaces' })).toBeNull();
    });
  });
  describe('when browsing documentation', () => {
    it('marks only Documentation current', async () => {
      server.use(http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)));
      renderRail('/resources');
      expect((await screen.findByRole('link', { name: 'Documentation' })).getAttribute('aria-current')).toBe('page');
      expect((await screen.findByRole('link', { name: 'Integrations' })).getAttribute('aria-current')).toBeNull();
    });
  });
  describe('when only tool access is permitted', () => {
    it('offers tools without unrelated library pages', async () => {
      server.use(
        authHandler({ ...adminSidebarCapabilities, access: { roles: ['tool-user'], permissions: ['tools:read'] } }),
      );
      renderRail('/tools');
      expect((await screen.findByRole('link', { name: 'Tools' })).getAttribute('href')).toBe('/tools');
      expect(screen.queryByRole('link', { name: 'Processors' })).toBeNull();
    });
  });
  describe('when a viewer can only read agents and workflows', () => {
    it('excludes tools from the rail', async () => {
      server.use(authHandler(viewerSidebarCapabilities));
      renderRail('/agents');
      await screen.findByRole('link', { name: 'Agents' });
      expect(screen.getByRole('link', { name: 'Workflows' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    });
  });
});
