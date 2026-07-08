/**
 * BDD coverage for `ChatSessionProvider` (`domains/chat/context`).
 *
 * The provider owns the agent-controller session plus the derived chat-run
 * state (`busy`, `showWorkingIndicator`) so those never travel through layout
 * props again. Driven end-to-end: real fetch/SSE transport, MSW at the
 * network boundary.
 */
import type { AgentControllerEvent, AgentControllerMessage, AgentControllerSessionState } from '@mastra/client-js';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider, useActiveProjectContext } from '../../../workspaces';
import { ChatSessionProvider, useChatSession } from '../ChatSessionProvider';
import { useThreadMessages } from '../ChatThreadMessages';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const NEXT_RESOURCE_ID = 'resource-next';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const NEXT_SESSION = `${API}/sessions/${NEXT_RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
});

const project: Project = {
  id: 'project-test',
  name: 'MastraCode Test',
  path: '/tmp/mastracode-test',
  resourceId: RESOURCE_ID,
  createdAt: 1,
};

const nextProject: Project = {
  id: 'project-next',
  name: 'MastraCode Next',
  path: '/tmp/mastracode-next',
  resourceId: NEXT_RESOURCE_ID,
  createdAt: 2,
};

function seedProject(projects: Project[] = [project], activeProject: Project = project) {
  localStorage.setItem('mastracode-projects', JSON.stringify(projects));
  localStorage.setItem('mastracode-active-project', activeProject.id);
}

function sessionState(resourceId = RESOURCE_ID): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

function sse(events: AgentControllerEvent[] = []): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      },
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function useAgentControllerHandlers(events: AgentControllerEvent[] = [], requests: string[] = [], stateStatus = 200) {
  server.use(
    http.post(`${API}/sessions`, () => {
      requests.push('create');
      return HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID });
    }),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => {
      requests.push('state');
      return HttpResponse.json(sessionState());
    }),
    http.get(NEXT_SESSION, () => {
      requests.push('state:next');
      return HttpResponse.json(sessionState(NEXT_RESOURCE_ID));
    }),
    http.put(`${SESSION}/state`, async ({ request }) => {
      requests.push(`setState:${JSON.stringify(await request.json())}`);
      if (stateStatus >= 400) return HttpResponse.json({ error: 'nope' }, { status: stateStatus });
      return HttpResponse.json(sessionState());
    }),
    http.put(`${NEXT_SESSION}/state`, async ({ request }) => {
      requests.push(`setState:next:${JSON.stringify(await request.json())}`);
      return HttpResponse.json(sessionState(NEXT_RESOURCE_ID));
    }),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${NEXT_SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${NEXT_SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${NEXT_SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse(events)),
    http.get(`${NEXT_SESSION}/stream`, () => sse(events)),
  );
}

function Probe() {
  const { status, transcript, busy, showWorkingIndicator } = useChatSession();
  const { selectProject } = useActiveProjectContext();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="thread-id">{transcript.threadId ?? '(none)'}</span>
      <span data-testid="entries-count">{transcript.entries.length}</span>
      <span data-testid="busy">{busy ? 'yes' : 'no'}</span>
      <span data-testid="working">{showWorkingIndicator ? 'yes' : 'no'}</span>
      <button onClick={() => void selectProject(nextProject)}>switch project</button>
    </div>
  );
}

function MessagesProbe() {
  const { messagesPending } = useThreadMessages();
  return <span data-testid="messages-pending">{messagesPending ? 'yes' : 'no'}</span>;
}

function renderProbe() {
  return renderWithProviders(
    <ActiveProjectProvider>
      <ChatSessionProvider>
        <Probe />
      </ChatSessionProvider>
    </ActiveProjectProvider>,
  );
}

describe('ChatSessionProvider', () => {
  it('given the first state request is still pending, then it shows the connection loading state without mounting children', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(http.get(SESSION, () => new Promise<Response>(() => {})));

    renderProbe();

    expect(screen.getByText('Connecting to agent…')).toBeInTheDocument();
    expect(screen.queryByTestId('status')).not.toBeInTheDocument();
  });

  it('given the initial session create fails, then it shows the connection error state without mounting children', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(http.post(`${API}/sessions`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })));

    renderProbe();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Disconnected. Check the server and reload to reconnect.'),
    );
    expect(screen.queryByTestId('status')).not.toBeInTheDocument();
  });

  it('given a dormant project without a resource id, then children still render with a connecting session', async () => {
    const dormantProject: Project = { ...project, id: 'project-dormant', resourceId: undefined };
    seedProject([dormantProject], dormantProject);
    server.use(http.get(`${TEST_BASE_URL}/web/project/resolve`, () => HttpResponse.json({ error: 'missing' }, { status: 404 })));

    renderProbe();

    expect(screen.getByTestId('status')).toHaveTextContent('connecting');
    expect(screen.getByTestId('thread-id')).toHaveTextContent('(none)');
  });

  it('given thread messages are still loading, then the loader exposes pending until the transcript hydrates', async () => {
    let resolveMessages: (messages: AgentControllerMessage[]) => void = () => {};
    seedProject();
    useAgentControllerHandlers();
    server.use(
      http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () =>
        new Promise<Response>(resolve => {
          resolveMessages = messages => resolve(HttpResponse.json({ messages }));
        }),
      ),
    );

    renderWithProviders(
      <ActiveProjectProvider>
        <ChatSessionProvider>
          <Probe />
          <MessagesProbe />
        </ChatSessionProvider>
      </ActiveProjectProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('messages-pending')).toHaveTextContent('yes'));
    resolveMessages([{ id: 'hydrated-message', role: 'user', content: [{ type: 'text', text: 'hydrated' }] }]);

    await waitFor(() => expect(screen.getByTestId('messages-pending')).toHaveTextContent('no'));
    await waitFor(() => expect(screen.getByTestId('entries-count')).toHaveTextContent('1'));
  });

  it('given a seeded project, when the session connects, then it binds the session to the workspace path before ready', async () => {
    const requests: string[] = [];
    seedProject();
    useAgentControllerHandlers([], requests);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('thread-id')).toHaveTextContent(THREAD_ID);
    expect(requests.slice(0, 3)).toEqual([
      'create',
      'setState:{"state":{"projectPath":"/tmp/mastracode-test"}}',
      'state',
    ]);
  });

  it('given the workspace bind fails, then the connection still becomes ready', async () => {
    const requests: string[] = [];
    seedProject();
    useAgentControllerHandlers([], requests, 500);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(requests).toContain('setState:{"state":{"projectPath":"/tmp/mastracode-test"}}');
  });

  it('given a different project is selected, then the new session is bound to the new workspace path', async () => {
    const requests: string[] = [];
    seedProject([project, nextProject]);
    useAgentControllerHandlers([], requests);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    await userEvent.click(screen.getByRole('button', { name: 'switch project' }));

    await waitFor(() => expect(requests).toContain('setState:next:{"state":{"projectPath":"/tmp/mastracode-next"}}'));
  });

  it('given an idle transcript, then busy and the working indicator are off', async () => {
    seedProject();
    useAgentControllerHandlers();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('busy')).toHaveTextContent('no');
    expect(screen.getByTestId('working')).toHaveTextContent('no');
  });

  it('given a reconnect re-sync returns a new state, then the thread messages cache is dropped and the transcript rehydrates', async () => {
    const requests: string[] = [];
    seedProject();

    server.use(
      http.post(`${API}/sessions`, () =>
        HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: 'thread-before-drop' }),
      ),
      http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
      http.get(SESSION, () => {
        requests.push('state');
        const threadId =
          requests.filter(request => request === 'state').length === 1 ? 'thread-before-drop' : 'thread-after-drop';
        return HttpResponse.json({ ...sessionState(), threadId });
      }),
      http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
      http.get(`${SESSION}/threads/thread-before-drop/messages`, () => {
        requests.push('messages:before');
        return HttpResponse.json({
          messages: [{ id: 'before-message', role: 'user', content: [{ type: 'text', text: 'before' }] }],
        });
      }),
      http.get(`${SESSION}/threads/thread-after-drop/messages`, () => {
        requests.push('messages:after');
        return HttpResponse.json({
          messages: [{ id: 'after-message', role: 'user', content: [{ type: 'text', text: 'after' }] }],
        });
      }),
      http.get(`${SESSION}/stream`, () => {
        requests.push('stream');
        if (requests.filter(request => request === 'stream').length === 1) {
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                setTimeout(() => controller.error(new Error('stream dropped')), 0);
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }
        return sse();
      }),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('thread-id')).toHaveTextContent('thread-before-drop'));
    await waitFor(() => expect(requests).toContain('messages:before'));
    await waitFor(() => expect(screen.getByTestId('thread-id')).toHaveTextContent('thread-after-drop'), {
      timeout: 2500,
    });
    await waitFor(() => expect(requests).toContain('messages:after'));
    await waitFor(() => expect(screen.getByTestId('entries-count')).toHaveTextContent('1'));
  });

  it('given a run started without streamed assistant text, then busy is on and the working indicator shows', async () => {
    seedProject();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('yes'));
    expect(screen.getByTestId('working')).toHaveTextContent('yes');
  });

  it('given a running turn whose last entry is a streaming assistant message with text, then the working indicator hides while busy stays on', async () => {
    seedProject();
    useAgentControllerHandlers([
      { type: 'agent_start' },
      {
        type: 'message_update',
        message: { id: 'assistant-stream', role: 'assistant', content: [{ type: 'text', text: 'Streaming now' }] },
      },
    ]);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('busy')).toHaveTextContent('yes'));
    await waitFor(() => expect(screen.getByTestId('working')).toHaveTextContent('no'));
  });

  it('given no provider, when useChatSession is called, then it throws a descriptive error', () => {
    expect(() => render(<Probe />)).toThrow('useChatSession must be used within a ChatSessionProvider');
  });
});
