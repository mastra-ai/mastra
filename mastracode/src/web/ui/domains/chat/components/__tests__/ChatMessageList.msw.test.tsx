/**
 * BDD coverage for `ChatMessageList` (`domains/chat/components`).
 *
 * The component owns the scrollable chat column: goal panel, connection
 * notice, empty-thread state, transcript entries, and the working indicator.
 * Driven end-to-end: real fetch/SSE transport, MSW at the network boundary.
 */
import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { ChatSessionProvider } from '../../context/ChatSessionProvider';
import { ChatMessageList } from '../ChatMessageList';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
});

function seedProject() {
  const project: Project = {
    id: 'project-test',
    name: 'MastraCode Test',
    path: '/tmp/mastracode-test',
    resourceId: RESOURCE_ID,
    gitBranch: 'main',
    createdAt: 1,
  };
  localStorage.setItem('mastracode-projects', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-project', project.id);
}

function sessionState(): AgentControllerSessionState {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
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

function useAgentControllerHandlers(events: AgentControllerEvent[] = []) {
  server.use(
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

function renderMessageList() {
  return renderWithProviders(
    <ActiveProjectProvider>
      <ChatSessionProvider>
        <ChatMessageList />
      </ChatSessionProvider>
    </ActiveProjectProvider>,
  );
}

describe('ChatMessageList', () => {
  it('given an empty thread, then it shows the welcome state with the project metadata', async () => {
    seedProject();
    useAgentControllerHandlers();
    renderMessageList();

    await waitFor(() => expect(screen.getByText('Ready for new conversation')).toBeInTheDocument());
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('MastraCode Test')).toBeInTheDocument();
    expect(screen.getByText('Resource ID')).toBeInTheDocument();
    expect(screen.getByText(RESOURCE_ID)).toBeInTheDocument();
    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('/tmp/mastracode-test')).toBeInTheDocument();
  });

  it('given streamed assistant text, then it renders the transcript entry', async () => {
    seedProject();
    useAgentControllerHandlers([
      { type: 'agent_start' },
      {
        type: 'message_update',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'Hello from the agent' }] },
        },
      },
      { type: 'agent_end' },
    ]);
    renderMessageList();

    await waitFor(() => expect(screen.getByText('Hello from the agent')).toBeInTheDocument());
  });

  it('given a running turn without streamed assistant text, then it shows the working indicator', async () => {
    seedProject();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    renderMessageList();

    await waitFor(() => expect(screen.getByLabelText('Agent is working')).toBeInTheDocument());
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('given the session fails to connect, then it shows the disconnected notice', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(http.post(`${API}/sessions`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderMessageList();

    await waitFor(() =>
      expect(screen.getByText('Disconnected. Check the server and reload to reconnect.')).toBeInTheDocument(),
    );
  });

  it('given a goal evaluation event, then it shows the goal panel with objective and progress', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'goal_evaluation',
        payload: { objective: 'Ship the refactor', status: 'active', iteration: 1, maxRuns: 5, passed: false },
      },
    ]);
    renderMessageList();

    await waitFor(() => expect(screen.getByText('Ship the refactor')).toBeInTheDocument());
    expect(screen.getByText('1/5')).toBeInTheDocument();
  });
});
