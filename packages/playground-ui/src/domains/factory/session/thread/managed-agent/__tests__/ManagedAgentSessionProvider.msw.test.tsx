// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useQuery } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SessionView } from '../../chat/components/SessionView';
import { SessionHostContext } from '../../chat/context/SessionHostContext';
import type { SessionHost, SessionHostData, SessionLinkProps } from '../../chat/context/SessionHostContext';
import { useChatSessionActions } from '../../chat/context/useChatSessionActions';
import { OverlaysProvider } from '../../chat/overlays';
import { ManagedAgentSessionProvider } from '../ManagedAgentSessionProvider';
import { SidebarProvider } from '@/ds/components/Sidebar';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGENT = 'coder';
const RESOURCE = 'user-1';
const THREAD = 'thread-1';
const AGENT_URL = `${TEST_BASE_URL}/api/agents/${AGENT}`;

const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));

const question: MastraDBMessage = {
  id: 'm1',
  role: 'user',
  createdAt: at(0),
  threadId: THREAD,
  resourceId: RESOURCE,
  content: { format: 2, parts: [{ type: 'text', text: 'Write the notes file' }] },
};

const awaitingApproval: MastraDBMessage = {
  id: 'm2',
  role: 'assistant',
  createdAt: at(1),
  threadId: THREAD,
  resourceId: RESOURCE,
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'writeFile', args: { path: 'notes.md' } },
      },
    ],
    metadata: {
      pendingToolApprovals: {
        'call-1': { toolCallId: 'call-1', toolName: 'writeFile', args: { path: 'notes.md' } },
      },
    },
  },
};

function useStaticQuery<T>(key: string, data: T) {
  return useQuery({ queryKey: ['test-host', key], queryFn: () => data });
}

const data: SessionHostData = {
  useProject: () => useStaticQuery('project', undefined),
  useProjects: () => useStaticQuery('projects', []),
  useProjectSettings: () => useStaticQuery('settings', undefined),
  useViewer: () => useStaticQuery('viewer', { authEnabled: false }),
  useUserSession: () =>
    useQuery({ queryKey: ['test-host', 'session'], queryFn: () => Promise.reject(new Error('none')), enabled: false }),
  useSessionList: () => useStaticQuery('sessions', { workspaces: [], userSessions: [] }),
  createUserSession: () => Promise.reject(new Error('not used')),
  answerParkedApproval: () => Promise.resolve(),
  onSessionTitleChanged: () => Promise.resolve(),
  invalidateSessions: () => Promise.resolve(),
};

const TestLink = forwardRef<HTMLAnchorElement, SessionLinkProps>(function TestLink({ returnHere: _, ...props }, ref) {
  return <a ref={ref} {...props} />;
});

const host: SessionHost = {
  factoryProjectId: undefined,
  sessionId: undefined,
  threadId: THREAD,
  draftSessionId: undefined,
  routeKind: 'user-thread',
  location: { pathname: `/sessions/${THREAD}`, search: '', state: null },
  LinkComponent: TestLink,
  navigate: () => {},
  links: {
    settings: section => `/settings/${section}`,
    thread: ({ threadId }) => `/sessions/${threadId}`,
    userThread: threadId => `/sessions/${threadId}`,
    newUserSession: () => '/sessions/new',
    channelThread: threadId => `/sessions/${threadId}`,
    knowledgePage: pageId => `/knowledge/${pageId}`,
    project: projectId => `/projects/${projectId}`,
    card: id => `/cards/${id}`,
    workItemBoard: () => '/board',
  },
  data,
};

function serveThread(history: MastraDBMessage[]) {
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const requests: { path: string; body: unknown }[] = [];
  const record = async (path: string, request: Request) => {
    requests.push({ path, body: await request.json() });
  };
  server.use(
    http.post(
      `${AGENT_URL}/threads/subscribe`,
      () =>
        new HttpResponse(
          new ReadableStream<Uint8Array>({
            start(controller) {
              stream = controller;
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    ),
    http.post(`${AGENT_URL}/send-message`, async ({ request }) => {
      await record('send-message', request);
      return HttpResponse.json({ runId: 'run-1', signal: { id: 'signal-1' } });
    }),
    http.post(`${AGENT_URL}/send-tool-approval`, async ({ request }) => {
      await record('send-tool-approval', request);
      return HttpResponse.json({ accepted: true, runId: 'run-0', toolCallId: 'call-1' });
    }),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json([])),
    http.get(`${TEST_BASE_URL}/api/memory/threads`, () =>
      HttpResponse.json({
        threads: [{ id: THREAD, title: 'Notes', resourceId: RESOURCE }],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      }),
    ),
  );
  const emit = async (chunk: unknown) => {
    await act(async () => {
      stream?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
    });
  };
  const ready = async () => {
    await waitFor(() => expect(stream).toBeDefined());
    await emit({ type: 'thread-history', runId: '', from: 'AGENT', payload: { messages: history, hasMore: false } });
  };
  return { emit, ready, requests };
}

function renderSession(children: ReactNode = <SessionView emptyState={<p>No messages yet</p>} />) {
  return renderWithProviders(
    <SessionHostContext.Provider value={host}>
      <SidebarProvider>
        <OverlaysProvider>
          <ManagedAgentSessionProvider agentId={AGENT} resourceId={RESOURCE} threadId={THREAD} baseUrl={TEST_BASE_URL}>
            {children}
          </ManagedAgentSessionProvider>
        </OverlaysProvider>
      </SidebarProvider>
    </SessionHostContext.Provider>,
  );
}

describe('ManagedAgentSessionProvider', () => {
  it('shows the stored thread and the tool call waiting on approval', async () => {
    const thread = serveThread([question, awaitingApproval]);
    renderSession();
    await thread.ready();

    expect(await screen.findByText('Write the notes file')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /approve/i })).toBeTruthy();
  });

  it('approves the waiting tool call through the agent', async () => {
    const user = userEvent.setup();
    const thread = serveThread([question, awaitingApproval]);
    renderSession();
    await thread.ready();

    await user.click(await screen.findByRole('button', { name: /approve/i }));

    await waitFor(() => expect(thread.requests.map(request => request.path)).toContain('send-tool-approval'));
    expect(thread.requests.find(request => request.path === 'send-tool-approval')?.body).toMatchObject({
      toolCallId: 'call-1',
      approved: true,
      threadId: THREAD,
    });
  });

  it('sends a message on the thread and streams the reply', async () => {
    const user = userEvent.setup();
    const thread = serveThread([]);
    renderSession();
    await thread.ready();

    const composer = await within(await screen.findByRole('region', { name: 'Thread composer' })).findByRole('textbox');
    await waitFor(() => expect(composer.getAttribute('aria-disabled')).not.toBe('true'));
    await user.type(composer, 'Hello there{Enter}');

    await waitFor(() => expect(thread.requests.map(request => request.path)).toContain('send-message'));
    expect(thread.requests[0]?.body).toMatchObject({ resourceId: RESOURCE, threadId: THREAD });

    await thread.emit({ type: 'start', runId: 'run-1', from: 'AGENT', payload: {} });
    await thread.emit({ type: 'text-start', runId: 'run-1', from: 'AGENT', payload: { id: 't1' } });
    await thread.emit({ type: 'text-delta', runId: 'run-1', from: 'AGENT', payload: { id: 't1', text: 'Hi, ready.' } });
    await thread.emit({ type: 'finish', runId: 'run-1', from: 'AGENT', payload: { stepResult: { reason: 'stop' } } });

    expect(await screen.findByText('Hi, ready.')).toBeTruthy();
  });

  it('lists the agent threads for the resource', async () => {
    function ThreadTitles() {
      const { threads } = useChatSessionActions();
      return <p>{threads?.list?.map(thread => thread.title).join(',')}</p>;
    }
    const thread = serveThread([]);
    renderSession(<ThreadTitles />);
    await thread.ready();

    expect(await screen.findByText('Notes')).toBeTruthy();
  });
});
