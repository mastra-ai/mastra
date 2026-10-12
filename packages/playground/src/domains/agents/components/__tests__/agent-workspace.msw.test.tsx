import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createContext, use, useContext } from 'react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgentDetailShell } from '../../agent-detail-shell';
import { AgentShell } from '../../agent-shell';
import { AgentWorkspaceView } from '../agent-workspace-view';
import { semanticRecallConfig } from '../memory-sidebar/__tests__/fixtures/memory';
import { workspacePackages } from './fixtures/agent-workspace';
import { emptyPlatforms } from './fixtures/channels';
import { FeatureWorkspaceLayout } from '@/components/feature-workspace-layout';
import { writeDeniedCapabilities } from '@/domains/agents/hooks/__tests__/fixtures/auth';
import { chatMemory, chatThreads } from '@/domains/chat/components/__tests__/fixtures/chat';
import { MessageTracesContext } from '@/lib/ai-ui/message-traces-context';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { agentsList, builderDisabled } from '@/pages/agents/__tests__/fixtures/agents';
import { draftAuthDisabled } from '@/pages/agents/agent/__tests__/fixtures/drafts';
import { aggregate, supportedStorage } from '@/pages/metrics/__tests__/fixtures/metrics';
import { legacyTraceCapabilities } from '@/pages/traces/__tests__/fixtures/trace-query';
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
        {use(MessageTracesContext) && <p>Message traces shown</p>}
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
        element: (
          <FeatureWorkspaceLayout>
            <Outlet />
          </FeatureWorkspaceLayout>
        ),
        children: [
          {
            path: '/agents/:agentId',
            handle: { navigationLabel: 'Agent navigation' },
            element: <AgentShell />,
            children: [
              {
                element: <AgentDetailShell />,
                children: [
                  { path: 'threads/new', element: <ChatView /> },
                  { path: 'threads/:threadId', element: <ChatView /> },
                  { path: 'overview', element: <ChatView /> },
                  { path: 'editor', element: <EditorView /> },
                ],
              },
            ],
          },
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
  describe('when inspecting an agent', () => {
    it('keeps every agent in the sidebar with the open one current', async () => {
      renderWorkspace('/agents/researcher/overview');
      const agents = await screen.findByRole('navigation', { name: 'Agents list' });
      const openAgent = await within(agents).findByRole('link', { name: 'Research Agent' });
      expect(openAgent.getAttribute('href')).toBe('/agents/researcher/overview');
      expect(openAgent.getAttribute('aria-current')).toBe('page');
      expect(within(agents).getByRole('link', { name: 'Analysis Agent' }).getAttribute('aria-current')).toBeNull();
    });
    it('keeps the same agents list when opening another agent', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/agents/analyst`, () => HttpResponse.json(agentsList.analyst)));
      renderWorkspace('/agents/researcher/overview');
      const agents = await screen.findByRole('navigation', { name: 'Agents list' });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search agents' }), { target: { value: 'a' } });
      fireEvent.click(await within(agents).findByRole('link', { name: 'Analysis Agent' }));
      await waitFor(() =>
        expect(within(agents).getByRole('link', { name: 'Analysis Agent' }).getAttribute('aria-current')).toBe('page'),
      );
      expect(screen.getByRole('navigation', { name: 'Agents list' })).toBe(agents);
      expect(screen.getByRole('searchbox', { name: 'Search agents' })).toHaveProperty('value', 'a');
    });
  });
  describe('when inspecting chat configuration', () => {
    it('starts closed, docks beside the conversation and links to the agent overview', async () => {
      renderWorkspace();
      await screen.findByText('Chat content');
      expect(screen.queryByRole('complementary', { name: 'Config' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Config', exact: true }));
      const config = await screen.findByRole('complementary', { name: 'Config' });
      expect(config.closest('main')).toBeTruthy();
      expect(screen.getByText('Chat content')).toBeTruthy();
      expect(await within(config).findByText('System Prompt')).toBeTruthy();
      fireEvent.click(within(config).getByRole('link', { name: 'Open overview' }));

      await screen.findByRole('navigation', { name: 'Agent views' });
      expect(screen.queryByRole('complementary', { name: 'Config' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Overview', exact: true }).getAttribute('aria-current')).toBe('page');
    });

    it('can be dismissed without leaving the conversation', async () => {
      renderWorkspace();
      fireEvent.click(await screen.findByRole('button', { name: 'Config', exact: true }));
      fireEvent.click(await screen.findByRole('button', { name: 'Close Config' }));
      await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Config' })).toBeNull());
      expect(screen.getByText('Chat content')).toBeTruthy();
    });
  });
  describe('when turning on the advanced view', () => {
    it('shows each message trace inside the conversation and keeps Config open', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(legacyTraceCapabilities)),
      );
      renderWorkspace('/agents/researcher/threads/thread-1');
      fireEvent.click(await screen.findByRole('button', { name: 'Config', exact: true }));
      await screen.findByRole('complementary', { name: 'Config' });

      fireEvent.click(await screen.findByRole('switch', { name: 'Advanced view' }));

      expect(await screen.findByText('Message traces shown')).toBeTruthy();
      expect(screen.getByRole('complementary', { name: 'Config' })).toBeTruthy();
      expect(screen.queryByRole('complementary', { name: 'Traces' })).toBeNull();

      fireEvent.click(screen.getByRole('switch', { name: 'Advanced view' }));
      await waitFor(() => expect(screen.queryByText('Message traces shown')).toBeNull());
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
    it('keeps the breadcrumb and view tabs while the Editor takes over the sidebar', async () => {
      renderWorkspace('/agents/researcher/overview');
      await screen.findByRole('navigation', { name: 'Agents list' });
      const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      const views = await screen.findByRole('navigation', { name: 'Agent views' });
      expect(within(views).getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe('page');
      fireEvent.click(within(views).getByRole('link', { name: 'Editor' }));
      const navigation = await screen.findByRole('complementary', { name: 'Agent navigation' });
      expect(await within(navigation).findByText('Editor settings')).toBeTruthy();
      expect(screen.queryByRole('navigation', { name: 'Agents list' })).toBeNull();
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBe(breadcrumb);
      expect(screen.getAllByRole('navigation', { name: 'Agent views' })).toHaveLength(1);
      expect(screen.getByText('Editor content').closest('aside')).toBeNull();
    });
  });
});
