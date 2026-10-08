import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { MastraReactProvider } from '@mastra/react';
import { useAgent } from '@mastra/react/hooks/agents';
import { useTool } from '@mastra/react/hooks/tools';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { createMemoryRouter, Outlet, RouterProvider, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildHistoryKey, readBuildHistory, rememberBuildResource } from '../../utils/build-resource-history';
import { RememberBuildResource } from '../remember-build-resource';
import { StudioAreaNavigation } from '../studio-area-navigation';
import { availableTools, packagesWithPromptEditing } from '@/components/__tests__/fixtures/studio-shell';
import { viewerSidebarCapabilities } from '@/components/ui/__tests__/fixtures/sidebar-permissions';
import { Link } from '@/lib/link';
import { agentsList, builderDisabled } from '@/pages/agents/__tests__/fixtures/agents';
import { draftAuthDisabled } from '@/pages/agents/agent/__tests__/fixtures/drafts';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const historyKey = buildHistoryKey(TEST_BASE_URL);
function AgentResource() {
  const [params] = useSearchParams();
  const tenant = params.get('tenant');
  const { data } = useAgent({ agentId: 'researcher', requestContext: tenant ? { tenant } : undefined });
  return <p>{data?.name}</p>;
}
function ToolResource() {
  const { data, error } = useTool({ toolId: 'weather', queryOptions: { retry: false } });
  return <p>{error ? 'Tool unavailable' : data?.id}</p>;
}
function HistoryLayout() {
  return (
    <>
      <RememberBuildResource />
      <Outlet />
    </>
  );
}
const OTHER_BASE_URL = 'http://other-instance:4111';
function InstanceSwitcher({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrl] = useState(TEST_BASE_URL);
  return (
    <MastraReactProvider baseUrl={baseUrl}>
      <button onClick={() => setBaseUrl(OTHER_BASE_URL)}>Switch instance</button>
      <output>{baseUrl}</output>
      {children}
    </MastraReactProvider>
  );
}
function renderHistory(path = '/agents/researcher/metrics', switchInstance = false) {
  const router = createMemoryRouter(
    [
      {
        element: <HistoryLayout />,
        children: [
          { path: '/agents', element: <StudioAreaNavigation areaId="build" /> },
          { path: '/agents/researcher/metrics', element: <AgentResource /> },
          { path: '/agents/researcher/threads/new', element: <AgentResource /> },
          { path: '/tools/weather', element: <ToolResource /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const tree = (
    <Sidebar.Provider LinkComponent={Link}>
      <RouterProvider router={router} />
    </Sidebar.Provider>
  );
  const rendered = renderWithProviders(switchInstance ? <InstanceSwitcher>{tree}</InstanceSwitcher> : tree);
  return { router, queryClient: rendered.queryClient };
}

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(draftAuthDisabled)),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderDisabled)),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithPromptEditing)),
    http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsList.researcher)),
    http.get(`${TEST_BASE_URL}/api/tools/weather`, () => HttpResponse.json(availableTools.weather)),
  );
});

describe('Build resource shortcuts', () => {
  describe('when resources from different catalogs have been opened', () => {
    it('shows their names and resumes the last visited section', async () => {
      const { router } = renderHistory();
      await waitFor(() => expect(readBuildHistory(historyKey).recent).toHaveLength(1));
      await act(() => router.navigate('/tools/weather'));
      await waitFor(() => expect(readBuildHistory(historyKey).recent).toHaveLength(2));
      await act(() => router.navigate('/agents'));
      const shortcuts = await screen.findByRole('navigation', { name: 'Build shortcuts' });
      expect(within(shortcuts).getByRole('link', { name: 'weather' }).getAttribute('href')).toBe('/tools/weather');
      const agentLink = within(shortcuts).getByRole('link', { name: 'Research Agent' });
      expect(agentLink.getAttribute('href')).toBe('/agents/researcher/metrics');
      fireEvent.click(agentLink);
      await waitFor(() => expect(router.state.location.pathname).toBe('/agents/researcher/metrics'));
    });
  });
  describe('when a recent resource is pinned', () => {
    it('keeps one shortcut and persists the pin across page changes', async () => {
      const { router } = renderHistory();
      await waitFor(() => expect(readBuildHistory(historyKey).recent).toHaveLength(1));
      await act(() => router.navigate('/agents'));
      fireEvent.click(await screen.findByRole('button', { name: 'Pin Research Agent' }));
      expect(readBuildHistory(historyKey).pinned).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: 'Research Agent' })).toHaveLength(1);
      await act(() => router.navigate('/tools/weather'));
      await act(() => router.navigate('/agents'));
      expect(await screen.findByRole('button', { name: 'Unpin Research Agent' })).toBeTruthy();
    });
  });
  describe('when a pinned resource is unpinned', () => {
    it('returns to Recently opened without losing its destination', async () => {
      const { router } = renderHistory();
      await waitFor(() => expect(readBuildHistory(historyKey).recent).toHaveLength(1));
      await act(() => router.navigate('/agents'));
      fireEvent.click(await screen.findByRole('button', { name: 'Pin Research Agent' }));
      fireEvent.click(screen.getByRole('button', { name: 'Unpin Research Agent' }));
      expect(readBuildHistory(historyKey).pinned).toEqual([]);
      expect(screen.getByRole('link', { name: 'Research Agent' }).getAttribute('href')).toBe(
        '/agents/researcher/metrics',
      );
    });
  });
  describe('when the resource cannot be loaded', () => {
    it('does not add a broken recent shortcut', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/tools/weather`, () => new HttpResponse(undefined, { status: 404 })));
      const { router } = renderHistory('/tools/weather');
      await screen.findByText('Tool unavailable');
      await act(() => router.navigate('/agents'));
      expect(
        await screen.findByText('Open an agent, workflow, prompt, tool, or processor to return to it here.'),
      ).toBeTruthy();
      expect(readBuildHistory(historyKey).recent).toEqual([]);
    });
  });
  describe('when the user opens a conversation', () => {
    it('does not mix chat destinations into Build history', async () => {
      const { router } = renderHistory('/agents/researcher/threads/new');
      await screen.findByText('Research Agent');
      await act(() => router.navigate('/agents'));
      expect(
        await screen.findByText('Open an agent, workflow, prompt, tool, or processor to return to it here.'),
      ).toBeTruthy();
      expect(readBuildHistory(historyKey).recent).toEqual([]);
    });
  });
  describe('when a saved resource is outside current permissions', () => {
    it('hides it while keeping accessible resources', async () => {
      const key = buildHistoryKey(TEST_BASE_URL, undefined, viewerSidebarCapabilities.user.id);
      rememberBuildResource(key, { kind: 'tool', id: 'weather', name: 'Private weather tool', path: '/tools/weather' });
      rememberBuildResource(key, {
        kind: 'agent',
        id: 'researcher',
        name: 'Research Agent',
        path: '/agents/researcher/metrics',
      });
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(viewerSidebarCapabilities)),
      );
      renderHistory('/agents');
      expect(await screen.findByRole('link', { name: 'Research Agent' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Private weather tool' })).toBeNull();
    });
  });
  describe('when another account has stored history', () => {
    it('keeps that account’s resource names private', async () => {
      rememberBuildResource(buildHistoryKey(TEST_BASE_URL, undefined, 'other-account'), {
        kind: 'agent',
        id: 'researcher',
        name: 'Other private agent',
        path: '/agents/researcher/metrics',
      });
      renderHistory('/agents');
      expect(
        await screen.findByText('Open an agent, workflow, prompt, tool, or processor to return to it here.'),
      ).toBeTruthy();
      expect(screen.queryByText('Other private agent')).toBeNull();
    });
  });
});

describe('Build history cache boundaries', () => {
  describe('when the active request context changes', () => {
    it('remembers the current name instead of an older cached variant', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents/researcher`, ({ request }) =>
          HttpResponse.json({
            ...agentsList.researcher,
            name: atob(new URL(request.url).searchParams.get('requestContext') ?? '').includes('second')
              ? 'Second context agent'
              : 'First context agent',
          }),
        ),
      );
      const { router } = renderHistory('/agents/researcher/metrics?tenant=first');
      await waitFor(() => expect(readBuildHistory(historyKey).recent[0]?.name).toBe('First context agent'));
      await act(() => router.navigate('/agents/researcher/metrics?tenant=second'));
      await waitFor(() => expect(readBuildHistory(historyKey).recent[0]?.name).toBe('Second context agent'));
    });
  });
  describe('when the connected instance changes while cached data remains', () => {
    it('waits for a new read before adding that instance’s shortcut', async () => {
      server.use(
        http.get(`${OTHER_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(draftAuthDisabled)),
        http.get(`${OTHER_BASE_URL}/api/agents/researcher`, () =>
          HttpResponse.json({ ...agentsList.researcher, name: 'Other instance agent' }),
        ),
      );
      const { queryClient } = renderHistory('/agents/researcher/metrics', true);
      await waitFor(() => expect(readBuildHistory(historyKey).recent[0]?.name).toBe('Research Agent'));
      fireEvent.click(screen.getByRole('button', { name: 'Switch instance' }));
      await screen.findByText(OTHER_BASE_URL);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      const otherKey = buildHistoryKey(OTHER_BASE_URL);
      expect(readBuildHistory(otherKey).recent).toEqual([]);
      await act(() => queryClient.invalidateQueries({ queryKey: ['agent'] }));
      await waitFor(() => expect(readBuildHistory(otherKey).recent[0]?.name).toBe('Other instance agent'));
    });
  });
});
