import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createContext, useContext } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgentDetailShell } from '../../agent-detail-shell';
import { ThreadsPanelProvider } from '../../context/threads-panel-context';
import { AgentWorkspaceView } from '../agent-workspace-view';
import { semanticRecallConfig } from '../memory-sidebar/__tests__/fixtures/memory';
import { workspacePackages } from './fixtures/agent-workspace';
import { emptyPlatforms } from './fixtures/channels';
import { writeDeniedCapabilities } from '@/domains/agents/hooks/__tests__/fixtures/auth';
import { chatMemory, chatThreads } from '@/domains/chat/components/__tests__/fixtures/chat';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { agentsList, builderDisabled } from '@/pages/agents/__tests__/fixtures/agents';
import { draftAuthDisabled } from '@/pages/agents/agent/__tests__/fixtures/drafts';
import { aggregate, supportedStorage, unsupportedStorage } from '@/pages/metrics/__tests__/fixtures/metrics';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const ViewContext = createContext('outside view');
function WorkingSection() {
  return <p>{useContext(ViewContext)}</p>;
}
function ChatView() {
  return (
    <ViewContext.Provider value="Thread-scoped settings">
      <AgentWorkspaceView navigation={<WorkingSection />}>
        <p>Chat content</p>
      </AgentWorkspaceView>
    </ViewContext.Provider>
  );
}
function EditorView() {
  return (
    <AgentWorkspaceView navigation={<p>Editor settings</p>}>
      <p>Editor content</p>
    </AgentWorkspaceView>
  );
}
function renderWorkspace(path = '/agents/researcher/threads/new') {
  const router = createMemoryRouter(
    [
      {
        path: '/agents/:agentId',
        element: (
          <ThreadsPanelProvider>
            <AgentDetailShell />
          </ThreadsPanelProvider>
        ),
        children: [
          { path: 'threads/new', element: <ChatView /> },
          { path: 'overview', element: <ChatView /> },
          { path: 'configuration', element: <ChatView /> },
          { path: 'editor', element: <EditorView /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  renderWithProviders(
    <LinkComponentProvider Link={Link} navigate={to => void router.navigate(to)} paths={paths}>
      <Sidebar.Provider LinkComponent={Link}>
        <RouterProvider router={router} />
      </Sidebar.Provider>
    </LinkComponentProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agentsList)),
    http.get(`${TEST_BASE_URL}/api/agents/researcher`, () => HttpResponse.json(agentsList.researcher)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(draftAuthDisabled)),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderDisabled)),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(workspacePackages)),
    http.get(`${TEST_BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
    http.get(`${TEST_BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
    http.get(`${TEST_BASE_URL}/api/memory/status`, () => HttpResponse.json(chatMemory)),
    http.get(`${TEST_BASE_URL}/api/memory/threads`, () => HttpResponse.json(chatThreads)),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(supportedStorage)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json(aggregate)),
  );
});

describe('Agent workspace composition', () => {
  describe('when memory and observability permissions are missing', () => {
    it('does not fetch or show chats and activity', async () => {
      const requests: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeDeniedCapabilities)),
        http.get(`${TEST_BASE_URL}/api/memory/threads`, ({ request }) => {
          requests.push(request.url);
          return HttpResponse.json(chatThreads);
        }),
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, ({ request }) => {
          requests.push(request.url);
          return HttpResponse.json(supportedStorage);
        }),
      );
      renderWorkspace('/agents/researcher/overview');
      await screen.findByText('Chat content');
      expect(screen.queryByRole('region', { name: 'Recent chats' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Agent activity' })).toBeNull();
      expect(requests).toEqual([]);
    });
  });
  describe('when metrics storage is unsupported', () => {
    it('explains availability instead of querying or inventing zero metrics', async () => {
      const requests: string[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(unsupportedStorage)),
        http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, ({ request }) => {
          requests.push(request.url);
          return HttpResponse.json(aggregate);
        }),
      );
      renderWorkspace('/agents/researcher/overview');
      expect(await screen.findByText('Activity metrics are not available with this storage.')).toBeTruthy();
      expect(requests).toEqual([]);
    });
  });
  describe('when inspecting an agent', () => {
    it('shows its recent chats and scopes its activity metrics to that agent', async () => {
      const filters: unknown[] = [];
      const threadQueries: URLSearchParams[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/memory/threads`, ({ request }) => {
          threadQueries.push(new URL(request.url).searchParams);
          return HttpResponse.json(chatThreads);
        }),
        http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, async ({ request }) => {
          filters.push(await request.json());
          return HttpResponse.json({ ...aggregate, value: 12 });
        }),
      );
      renderWorkspace('/agents/researcher/overview');
      const navigation = await screen.findByRole('complementary', { name: 'Agent navigation' });
      const chat = await within(navigation).findByRole('link', { name: 'Research notes' });
      expect(chat.getAttribute('href')).toBe('/agents/researcher/threads/last-chat');
      expect(threadQueries[0].get('agentId')).toBe('researcher');
      expect(threadQueries[0].get('resourceId')).toBe('researcher');
      expect(threadQueries[0].get('orderBy[field]')).toBe('updatedAt');
      await within(navigation).findByText('12');
      expect(filters.length).toBeGreaterThan(0);
      for (const request of filters)
        expect(request).toMatchObject({ filters: { rootEntityType: 'agent', entityName: 'Research Agent' } });
      expect(within(navigation).queryByRole('navigation', { name: 'Agent resources' })).toBeNull();
    });
  });
  describe('when inspecting chat configuration', () => {
    it('starts closed, opens in the chat and links to advanced agent configuration', async () => {
      renderWorkspace();
      await screen.findByText('Chat content');
      expect(screen.queryByRole('dialog', { name: 'Config' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Config', exact: true }));
      const config = await screen.findByRole('dialog', { name: 'Config' });
      expect(config.closest('main')).toBeTruthy();
      expect(await within(config).findByText('System Prompt')).toBeTruthy();
      fireEvent.click(within(config).getByRole('link', { name: 'Advanced config' }));

      await screen.findByRole('navigation', { name: 'Agent views' });
      expect(screen.queryByRole('dialog', { name: 'Config' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Configuration', exact: true }).getAttribute('aria-current')).toBe(
        'page',
      );
    });

    it('can be dismissed without leaving the conversation', async () => {
      renderWorkspace();
      fireEvent.click(await screen.findByRole('button', { name: 'Config', exact: true }));
      fireEvent.click(await screen.findByRole('button', { name: 'Close Config' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Config' })).toBeNull());
      expect(screen.getByText('Chat content')).toBeTruthy();
    });
  });
  describe('when Chat supplies its working sections', () => {
    it('renders them in the route sidebar with the original view context', async () => {
      renderWorkspace();
      const navigation = await screen.findByRole('complementary', { name: 'Agent navigation' });
      expect(await within(navigation).findByText('Thread-scoped settings')).toBeTruthy();
      expect(screen.getByText('Chat content').closest('aside')).toBeNull();
      expect(within(navigation).queryByRole('link', { name: 'Editor' })).toBeNull();
      expect(within(navigation).queryByRole('link', { name: 'Traces' })).toBeNull();
    });
  });
  describe('when switching from Overview to Editor', () => {
    it('keeps one sidebar and breadcrumb while replacing the working sections', async () => {
      renderWorkspace('/agents/researcher/overview');
      const navigation = await screen.findByRole('complementary', { name: 'Agent navigation' });
      await within(navigation).findByText('Thread-scoped settings');
      const activeAgent = await within(navigation).findByRole('link', { name: 'Research Agent', exact: true });
      expect(activeAgent.getAttribute('href')).toBe('/agents/researcher/overview');
      expect(activeAgent.getAttribute('aria-current')).toBe('page');
      expect(within(navigation).getByRole('link', { name: 'All agents' }).getAttribute('href')).toBe('/agents');
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      fireEvent.click(await within(navigation).findByRole('link', { name: 'Editor', exact: true }));
      expect(await within(navigation).findByText('Editor settings')).toBeTruthy();
      expect(screen.queryByText('Thread-scoped settings')).toBeNull();
      expect(screen.getByRole('complementary', { name: 'Agent navigation' })).toBe(navigation);
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBe(breadcrumb);
      expect(within(navigation).getByRole('link', { name: 'Research Agent', exact: true })).toBe(activeAgent);
      expect(screen.getAllByRole('navigation', { name: 'Agent views' })).toHaveLength(1);
      expect(screen.getByText('Editor content').closest('aside')).toBeNull();
    });
  });
});
