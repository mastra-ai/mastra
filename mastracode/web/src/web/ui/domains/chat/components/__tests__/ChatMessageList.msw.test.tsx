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

import { ChatSessionTestProvider as ChatSessionProvider } from '../../context/ChatSessionTestProvider';
import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Factory } from '../../../workspaces';
import { ActiveFactoryProvider } from '../../../workspaces';
import { ChatMessageList } from '../ChatMessageList';
import { TaskPanel } from '../TaskPanel';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-test';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';

afterEach(() => {
  localStorage.clear();
});

function seedProject() {
  const project: Factory = {
    id: 'project-test',
    name: 'MastraCode Test',
    resourceId: RESOURCE_ID,
    binding: { kind: 'local', path: '/tmp/mastracode-test', gitBranch: 'main' },
    createdAt: 1,
  };
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
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
    <MemoryRouter initialEntries={[`/factories/project-test/threads/${THREAD_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/threads/:threadId"
          element={
            <ActiveFactoryProvider factoryId="project-test">
              <ChatSessionProvider threadId={THREAD_ID}>
                <ChatMessageList />
                <TaskPanel />
              </ChatSessionProvider>
            </ActiveFactoryProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatMessageList', () => {
  it('given an empty thread, then it shows conversation starters with optional project context', async () => {
    const user = userEvent.setup();
    seedProject();
    useAgentControllerHandlers();
    renderMessageList();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'What can I help you build?' })).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Mastra Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore this codebase' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan a feature' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review recent changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Debug an issue' })).toBeInTheDocument();

    await user.click(screen.getByText(/Working in/));
    expect(screen.getByText('Factory')).toBeVisible();
    expect(screen.getAllByText('MastraCode Test')).toHaveLength(2);
    expect(screen.getByText('Resource ID')).toBeVisible();
    expect(screen.getByText(RESOURCE_ID)).toBeVisible();
    expect(screen.getByText('Branch')).toBeVisible();
    expect(screen.getByText('main')).toBeVisible();
    expect(screen.getByText('Workspace')).toBeVisible();
    expect(screen.getByText('/tmp/mastracode-test')).toBeVisible();
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

  it('given a live task snapshot, then it renders the current tasks outside the transcript', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'task_updated',
        tasks: [{ id: 'one', content: 'Restore tool UI', activeForm: 'Restoring tool UI', status: 'in_progress' }],
      },
    ]);
    renderMessageList();

    const taskPanel = await screen.findByRole('region', { name: 'Current tasks' });
    expect(taskPanel).toHaveTextContent('Restoring tool UI');
  });

  it('given a streamed notification signal, then it renders the notification provenance in the transcript', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'message_update',
        message: {
          id: 'notification-message-1',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'I will inspect the updated pull request.' }] },
        },
      },
      {
        type: 'notification',
        notificationId: 'notification-1',
        message: 'octo/repo#42 received a new comment',
        source: 'github',
        kind: 'issue-comment-created',
        priority: 'high',
        metadata: {
          action: 'created',
          repository: 'octo/repo',
          pullRequestNumber: 42,
          targetUrl: 'https://github.com/octo/repo/pull/42#issuecomment-123',
        },
      },
      {
        type: 'notification',
        notificationId: 'notification-2',
        message: 'octo/repo#42 was merged',
        source: 'github',
        kind: 'pull-request-merged',
        priority: 'urgent',
      },
      {
        type: 'notification',
        notificationId: 'notification-3',
        message: 'octo/repo#43 was closed',
        source: 'github',
        kind: 'pull-request-closed',
        priority: 'urgent',
      },
    ]);
    renderMessageList();

    await waitFor(() => expect(screen.getByText('octo/repo#42 received a new comment')).toBeInTheDocument());
    expect(screen.getAllByText('octo/repo#42 received a new comment')).toHaveLength(1);
    expect(screen.getAllByText('octo/repo#42 was merged')).toHaveLength(1);
    expect(screen.getAllByText('octo/repo#43 was closed')).toHaveLength(1);
    expect(screen.getByText('I will inspect the updated pull request.')).toBeInTheDocument();
    expect(screen.getAllByText('github')).toHaveLength(3);
    expect(screen.queryByText('high')).not.toBeInTheDocument();
    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
    const targetLink = screen.getByRole('link', { name: /Open notification target/ });
    expect(targetLink).toHaveAttribute('href', 'https://github.com/octo/repo/pull/42#issuecomment-123');
    expect(targetLink.querySelector('[data-notification-state="notification"]')).toBeInTheDocument();
    expect(screen.getByText('octo/repo#42 was merged').closest('[data-notification-state]')).toHaveAttribute(
      'data-notification-state',
      'merged',
    );
    expect(screen.getByText('octo/repo#43 was closed').closest('[data-notification-state]')).toHaveAttribute(
      'data-notification-state',
      'closed',
    );
  });

  it('given an assistant response after a notification summary, then it does not render the response as a notice', async () => {
    seedProject();
    useAgentControllerHandlers([
      {
        type: 'notification_summary',
        message: 'github: 1',
        pending: 1,
        bySource: { github: 1 },
        byPriority: { high: 1 },
        notificationIds: ['notification-1'],
      },
      {
        type: 'message_update',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'The pull request is ready for review.' }] },
        },
      },
    ]);
    renderMessageList();

    await waitFor(() => expect(screen.getByText('The pull request is ready for review.')).toBeInTheDocument());
    expect(screen.getByText('Notification summary')).toBeInTheDocument();
    expect(screen.getByText('github: 1')).toBeInTheDocument();
    expect(screen.queryByText('1 pending')).not.toBeInTheDocument();
    expect(screen.getByText('The pull request is ready for review.').closest('.bg-notice-info\\/20')).toBeNull();
  });

  it('given a persisted user signal, then it renders in the right-aligned user bubble after hydration', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(
      http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () =>
        HttpResponse.json({
          messages: [
            {
              id: 'user-signal-1',
              role: 'signal',
              createdAt: '2026-07-15T16:00:00.000Z',
              content: {
                format: 2,
                parts: [{ type: 'text', text: 'sup' }],
                metadata: {
                  signal: {
                    id: 'user-signal-1',
                    type: 'user',
                    tagName: 'user',
                    createdAt: '2026-07-15T16:00:00.000Z',
                    contents: [{ type: 'text', text: 'sup' }],
                    attributes: { delivery: 'message' },
                  },
                },
              },
            },
          ],
        }),
      ),
    );
    renderMessageList();

    await waitFor(() => {
      const message = screen.getByText('sup');
      const userRow = message.closest('.items-end');
      expect(userRow).toBeInTheDocument();
      expect(userRow?.firstElementChild).toHaveClass('max-w-[70%]', 'bg-surface3');
    });
  });

  it('given a persisted skill activation, then it renders a compact card with expandable contents', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(
      http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () =>
        HttpResponse.json({
          messages: [
            {
              id: 'skill-activation-1',
              role: 'user',
              createdAt: '2026-07-16T18:00:00.000Z',
              content: {
                format: 2,
                parts: [
                  {
                    type: 'text',
                    text: '<skill name="understand-issue">\n# Understand Issue\n\nInvestigate every relevant code path.\n\nARGUMENTS: https://github.com/mastra-ai/mastra/issues/15\n</skill>',
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    renderMessageList();

    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', { name: 'Show understand-issue skill contents' });
    expect(screen.getByText('understand-issue')).toBeInTheDocument();
    expect(screen.getByText('https://github.com/mastra-ai/mastra/issues/15')).toBeInTheDocument();
    expect(screen.queryByText('Investigate every relevant code path.')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByText('Investigate every relevant code path.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide understand-issue skill contents' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide understand-issue skill contents' }));
    expect(screen.queryByText('Investigate every relevant code path.')).not.toBeInTheDocument();
  });

  it('given skill-like markup outside the exact TUI envelope, then it remains a normal message', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(
      http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () =>
        HttpResponse.json({
          messages: [
            {
              id: 'ordinary-xml-message',
              role: 'user',
              createdAt: '2026-07-16T18:01:00.000Z',
              content: {
                format: 2,
                parts: [
                  {
                    type: 'text',
                    text: 'Please inspect this literal example:\n<skill name="understand-issue">\nnot an invocation\n</skill>',
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    renderMessageList();

    await screen.findByText(/not an invocation/);
    expect(screen.queryByRole('button', { name: /understand-issue skill contents/ })).not.toBeInTheDocument();
  });

  it('given a persisted notification signal, then it remains visible after transcript hydration', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(
      http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () =>
        HttpResponse.json({
          messages: [
            // Shape produced by core's signalToDBMessage for a delivered notification.
            {
              id: 'notification-message-1',
              role: 'signal',
              type: 'notification',
              createdAt: new Date().toISOString(),
              content: {
                format: 2,
                parts: [{ type: 'text', text: 'octo/repo#42 was approved' }],
                metadata: {
                  signal: {
                    id: 'notification-1',
                    type: 'notification',
                    tagName: 'notification',
                    createdAt: new Date().toISOString(),
                    attributes: {
                      id: 'notification-1',
                      source: 'github',
                      type: 'pull-request-review',
                      kind: 'pull-request-review',
                      priority: 'urgent',
                      status: 'pending',
                    },
                    metadata: {
                      notification: {
                        signal: 'notification',
                        recordId: 'notification-1',
                        source: 'github',
                        kind: 'pull-request-review',
                        priority: 'urgent',
                        status: 'pending',
                      },
                    },
                  },
                },
              },
            },
          ],
        }),
      ),
    );
    renderMessageList();

    await waitFor(() => expect(screen.getByText('octo/repo#42 was approved')).toBeInTheDocument());
    expect(screen.getByText('github')).toBeInTheDocument();
    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
  });

  it('given a running turn without streamed assistant text, then it shows the working indicator', async () => {
    seedProject();
    useAgentControllerHandlers([{ type: 'agent_start' }]);
    renderMessageList();

    await waitFor(() => expect(screen.getByLabelText('Agent is working')).toBeInTheDocument());
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('given a persisted status part without text, then no empty notice bubble renders', async () => {
    seedProject();
    useAgentControllerHandlers();
    server.use(
      http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () =>
        HttpResponse.json({
          messages: [
            {
              id: 'status-1',
              role: 'assistant',
              createdAt: new Date().toISOString(),
              content: { format: 2, parts: [], metadata: { harnessContent: [{ type: 'om_compaction' }] } },
            },
            {
              id: 'status-2',
              role: 'assistant',
              createdAt: new Date().toISOString(),
              content: {
                format: 2,
                parts: [],
                metadata: { harnessContent: [{ type: 'om_summary', text: 'Memory updated' }] },
              },
            },
            {
              id: 'status-3',
              role: 'assistant',
              createdAt: new Date().toISOString(),
              content: {
                format: 2,
                parts: [{ type: 'text', text: 'This is an ordinary agent response.' }],
                metadata: { harnessContent: [{ type: 'om_compaction' }] },
              },
            },
          ],
        }),
      ),
    );
    renderMessageList();

    // The status part with text renders as a notice…
    await waitFor(() => expect(screen.getByText('Memory updated')).toBeInTheDocument());
    // …the text-less one renders nothing instead of an empty bubble.
    const notices = document.querySelectorAll('.bg-notice-info\\/20');
    expect(notices).toHaveLength(1);
    expect(screen.getByText('This is an ordinary agent response.').closest('.bg-notice-info\\/20')).toBeNull();
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
