/**
 * BDD coverage for `ChatSessionProvider` (`domains/chat/context`).
 *
 * The provider owns the agent-controller session plus the derived chat-run
 * state (`busy`, `showWorkingIndicator`) so those never travel through layout
 * props again. Driven end-to-end: real fetch/SSE transport, MSW at the
 * network boundary.
 */
import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../../workspaces';
import { ActiveProjectProvider } from '../../../workspaces';
import { ChatSessionProvider, useChatSession } from '../ChatSessionProvider';

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

function Probe() {
  const { status, transcript, busy, showWorkingIndicator } = useChatSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="thread-id">{transcript.threadId ?? '(none)'}</span>
      <span data-testid="busy">{busy ? 'yes' : 'no'}</span>
      <span data-testid="working">{showWorkingIndicator ? 'yes' : 'no'}</span>
    </div>
  );
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
  it('given a seeded project, when the session connects, then it exposes ready status and the thread id', async () => {
    seedProject();
    useAgentControllerHandlers();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('thread-id')).toHaveTextContent(THREAD_ID);
  });

  it('given an idle transcript, then busy and the working indicator are off', async () => {
    seedProject();
    useAgentControllerHandlers();
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('busy')).toHaveTextContent('no');
    expect(screen.getByTestId('working')).toHaveTextContent('no');
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
