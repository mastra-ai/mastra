// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import AgentThread from '../thread';
import { agentIndexLoader, agentThreadsIndexLoader, legacyAgentChatLoader, paths } from '@/lib/app-routing';
import { LinkComponentProvider } from '@/lib/framework';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';
const THREAD_ID = 'thread-1';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
};

const buildRouter = (initialEntry: string) =>
  createMemoryRouter(
    [
      {
        element: (
          <>
            <LocationProbe />
            <AgentThread />
          </>
        ),
        path: '/agents/:agentId/threads/:threadId',
      },
      { path: '/agents/:agentId/threads', loader: agentThreadsIndexLoader },
      { path: '/agents/:agentId', loader: agentIndexLoader },
      { path: '/agents/:agentId/overview', element: <LocationProbe /> },
      { path: '/agents/:agentId/chat', loader: legacyAgentChatLoader },
      { path: '/agents/:agentId/chat/:threadId', loader: legacyAgentChatLoader },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = buildRouter(initialEntry);

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={to => void router.navigate(to)} paths={paths}>
          <RouterProvider router={router} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return router;
};

const agentResponse = {
  id: AGENT_ID,
  name: 'Chef Agent',
  instructions: 'cook things',
  tools: {},
  workflows: {},
  provider: 'openai',
  modelId: 'openai/gpt-5-mini',
  modelVersion: 'v2',
  supportsMemory: true,
  defaultOptions: {},
};

const threadsResponse = {
  threads: [
    {
      id: THREAD_ID,
      resourceId: AGENT_ID,
      title: 'Pasta night',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'thread-2',
      resourceId: AGENT_ID,
      title: 'Sushi ideas',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

function installHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agentResponse)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: true, memoryType: 'local' })),
    http.get(`${BASE_URL}/api/memory/threads`, () => HttpResponse.json(threadsResponse)),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () =>
      HttpResponse.json({
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            type: 'text',
            createdAt: new Date().toISOString(),
            content: { format: 2, parts: [{ type: 'text', text: 'Tonight we cook carbonara.' }] },
          },
        ],
      }),
    ),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Standalone thread page', () => {
  it('shows the thread conversation at /agents/:agentId/threads/:threadId', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect(await screen.findByText('Tonight we cook carbonara.')).not.toBeNull();
  });

  it('shows the thread list next to the chat', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    expect(await screen.findByText('Sushi ideas')).not.toBeNull();
  });

  it('shows the Mastra logo and a back link to the agent overview in the sidebar', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    const back = screen.getByTestId('thread-sidebar-back');
    expect(back.getAttribute('href')).toBe(`/agents/${AGENT_ID}/overview`);
    expect(back.textContent).toContain('Back to');
  });

  it('navigates to another thread when clicked in the list', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    const otherThread = await screen.findByText('Sushi ideas');
    fireEvent.click(otherThread);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/thread-2`),
    );
  });

  it('does not render the agent page tabs (full-screen page)', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    await screen.findByText('Tonight we cook carbonara.');
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('redirects /agents/:agentId/threads to /threads/new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/threads`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
    );
  });

  it('redirects bare /agents/:agentId to the overview page', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}`);

    await waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/overview`));
  });

  it('redirects the legacy chat URL to /threads/:threadId preserving ?messageId=', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/chat/${THREAD_ID}?messageId=msg-1`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(
        `/agents/${AGENT_ID}/threads/${THREAD_ID}?messageId=msg-1`,
      ),
    );
  });

  it('redirects the legacy /chat URL to /threads/new', async () => {
    installHandlers();
    renderAt(`/agents/${AGENT_ID}/chat`);

    await waitFor(() =>
      expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/threads/new`),
    );
  });

  it('shows the session expired screen on a 401', async () => {
    installHandlers();
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 }),
      ),
    );
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect((await screen.findAllByText(/session.*expired/i)).length).toBeGreaterThan(0);
  });

  it('shows the permission denied screen on a 403', async () => {
    installHandlers();
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json({ error: 'forbidden' }, { status: 403 })),
    );
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect(await screen.findByText('Permission Denied')).not.toBeNull();
  });

  it('shows "Agent not found" for an unknown agent', async () => {
    installHandlers();
    server.use(http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(null)));
    renderAt(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);

    expect(await screen.findByText('Agent not found')).not.toBeNull();
  });
});

describe('thread link builders', () => {
  it('point to the standalone thread routes', () => {
    expect(paths.agentLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/overview`);
    expect(paths.agentNewThreadLink(AGENT_ID)).toBe(`/agents/${AGENT_ID}/threads/new`);
    expect(paths.agentThreadLink(AGENT_ID, THREAD_ID)).toBe(`/agents/${AGENT_ID}/threads/${THREAD_ID}`);
    expect(paths.agentThreadLink(AGENT_ID, THREAD_ID, 'msg-1')).toBe(
      `/agents/${AGENT_ID}/threads/${THREAD_ID}?messageId=msg-1`,
    );
  });
});
