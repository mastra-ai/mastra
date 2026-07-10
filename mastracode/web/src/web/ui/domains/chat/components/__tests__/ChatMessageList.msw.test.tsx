/**
 * BDD coverage for `ChatMessageList` (`domains/chat/components`).
 *
 * The component owns the scrollable chat column: goal panel, connection
 * notice, empty-thread state, transcript entries, and the working indicator.
 * Driven end-to-end: real fetch/SSE transport, MSW at the network boundary.
 */
import type { AgentControllerEvent, AgentControllerSessionState } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
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
    http.post(`${SESSION}/goal`, () => HttpResponse.json({})),
    http.put(`${SESSION}/goal`, () => HttpResponse.json({})),
    http.delete(`${SESSION}/goal`, () => HttpResponse.json({})),
    http.post(`${SESSION}/tool-approval`, () => HttpResponse.json({})),
    http.post(`${SESSION}/tool-suspension`, () => HttpResponse.json({})),
    http.get(`${SESSION}/stream`, () => sse(events)),
  );
}

function renderMessageList() {
  // Mounted on the thread's own page: /chat is the draft composer and hides
  // the bound thread's transcript.
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ActiveProjectProvider>
              <ChatSessionProvider>
                <ChatMessageList />
              </ChatSessionProvider>
            </ActiveProjectProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
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
        message: { id: 'assistant-1', role: 'assistant', content: [{ type: 'text', text: 'Hello from the agent' }] },
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

  it('hides the goal panel when no goal is set', async () => {
    seedProject();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    renderMessageList();

    // Wait for the stream to be consumed, then assert no goal UI is present —
    // goals are started via the /goal slash command, not an always-on form.
    await waitFor(() => expect(screen.getByLabelText('Agent is working')).toBeInTheDocument());
    expect(screen.queryByPlaceholderText('Set a goal objective…')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set Goal' })).not.toBeInTheDocument();
  });

  it('pauses, resumes, and clears a displayed goal through the agent controller', async () => {
    seedProject();
    const goal = { objective: 'Ship the refactor', iteration: 1, maxRuns: 5, passed: false };
    useAgentControllerHandlers([{ type: 'goal_evaluation', payload: { ...goal, status: 'active' } }]);
    const updates: unknown[] = [];
    let clearCount = 0;
    server.use(
      http.put(`${SESSION}/goal`, async ({ request }) => {
        updates.push(await request.json());
        return HttpResponse.json({});
      }),
      http.delete(`${SESSION}/goal`, () => {
        clearCount += 1;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderMessageList();

    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(updates).toEqual([{ status: 'paused' }]));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(clearCount).toBe(1));
  });

  it('resumes a paused goal through the agent controller', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'goal_evaluation',
        payload: { objective: 'Ship the refactor', status: 'paused', iteration: 1, maxRuns: 5, passed: false },
      },
    ]);
    let body: unknown;
    server.use(
      http.put(`${SESSION}/goal`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderMessageList();

    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(body).toEqual({ status: 'active' }));
  });

  it('responds to approval and plan suspension prompts, then removes them', async () => {
    seedProject();
    useAgentControllerHandlers([
      { type: 'tool_approval_required', toolCallId: 'tool-call-1', toolName: 'write_file', args: { path: 'test.ts' } },
      { type: 'tool_approval_required', toolCallId: 'tool-call-3', toolName: 'request_access', args: { path: '/tmp' } },
      {
        type: 'tool_suspended',
        toolCallId: 'tool-call-2',
        toolName: 'submit_plan',
        args: {},
        suspendPayload: { plan: { title: 'Refactor the chat', summary: 'Split the transcript UI.' } },
      },
    ]);
    const approvals: unknown[] = [];
    const suspensions: unknown[] = [];
    server.use(
      http.post(`${SESSION}/tool-approval`, async ({ request }) => {
        approvals.push(await request.json());
        return HttpResponse.json({});
      }),
      http.post(`${SESSION}/tool-suspension`, async ({ request }) => {
        suspensions.push(await request.json());
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderMessageList();

    await user.click(await screen.findByRole('button', { name: 'Approve write_file' }));
    await waitFor(() => expect(approvals).toEqual([{ toolCallId: 'tool-call-1', approved: true }]));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Tool approval for write_file' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Decline request_access' }));
    await waitFor(() =>
      expect(approvals).toEqual([
        { toolCallId: 'tool-call-1', approved: true },
        { toolCallId: 'tool-call-3', approved: false },
      ]),
    );
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Tool approval for request_access' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Approve the plan and switch to build' }));
    await waitFor(() =>
      expect(suspensions).toEqual([{ toolCallId: 'tool-call-2', resumeData: { action: 'approved' } }]),
    );
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Plan approval' })).not.toBeInTheDocument());
  });
});
