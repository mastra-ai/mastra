import type { AgentControllerEvent, AgentControllerThreadInfo, MastraDBMessage } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';
import type { WireDisplayState } from '@mastra/core/agent-controller';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { createAppRoutes } from '../../router';
import { assistantOnlyThreadMessages, threadRailMessagesWithEcho } from './fixtures/thread-rail';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const ROUTE_THREAD_ID = 'thread-2';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;
const checkoutArgs = { command: 'gh pr checkout 123' };
const initiatingPayload = {
  id: 'review-request',
  type: 'user',
  tagName: 'user',
  contents: 'Review pull request #123.',
  createdAt: '2026-09-08T10:00:00.000Z',
  providerOptions: { mastra: { author: { id: 'user-1', name: 'Damien' } } },
};
const initiatingMessage: MastraDBMessage = {
  id: initiatingPayload.id,
  role: 'signal',
  createdAt: new Date(initiatingPayload.createdAt),
  content: {
    format: 2,
    parts: [{ type: 'data-user-message', data: initiatingPayload }],
    metadata: { signal: initiatingPayload },
  },
};
const checkoutMessage: MastraDBMessage = {
  id: 'live-1',
  role: 'assistant',
  createdAt: new Date('2026-09-08T10:00:01.000Z'),
  content: {
    format: 2,
    parts: [
      { type: 'text', text: 'Checking out the pull request.' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'execute_command', args: checkoutArgs },
      },
    ],
  },
};

const userSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'user/my-feature',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function sessionSnapshot(
  messages: MastraDBMessage[],
  displayState: Partial<WireDisplayState> = {},
  streamingMessageId: string | null = null,
): AgentControllerEvent {
  return {
    type: 'session_snapshot',
    messages,
    streamingMessageId,
    displayState: {
      ...defaultDisplayState(),
      activeTools: {},
      toolInputBuffers: {},
      pendingSuspensions: {},
      activeSubagents: {},
      modifiedFiles: {},
      currentMessage: messages.at(-1) ?? null,
      ...displayState,
    },
  };
}

function stubThreadRoute({
  initialThreadId = SESSION_ID,
  threads = [],
  messages = [],
  sessionState = {},
  streamed = [sessionSnapshot([])],
}: {
  initialThreadId?: string;
  threads?: AgentControllerThreadInfo[];
  messages?: MastraDBMessage[];
  sessionState?: Record<string, unknown>;
  streamed?: AgentControllerEvent[];
} = {}) {
  const sessionGate = deferred();
  const messagesGate = deferred();
  const encoder = new TextEncoder();
  const onSwitchThread = vi.fn<(threadId: string) => void>();
  let activeThreadId = initialThreadId;

  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/model-packs`, () =>
      HttpResponse.json({ packs: [], activePackId: null, sessionPackId: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'conn-1',
            installationId: 'inst-1',
            repositories: [
              {
                id: REPO_ID,
                branch: 'main',
                sandboxWorkdir: '/repo',
                repository: { slug: 'acme/app', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, async () => {
      await sessionGate.promise;
      return HttpResponse.json({ session: userSession });
    }),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: activeThreadId }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: activeThreadId,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
        ...sessionState,
      }),
    ),
    http.post(`${AC}/sessions/:resourceId/thread`, async ({ request }) => {
      const body: unknown = await request.json();
      if (typeof body === 'object' && body !== null && 'threadId' in body && typeof body.threadId === 'string') {
        activeThreadId = body.threadId;
        onSwitchThread(body.threadId);
      }
      return HttpResponse.json({ ok: true });
    }),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              for (const event of streamed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            },
            cancel() {},
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, async () => {
      await messagesGate.promise;
      return HttpResponse.json({ messages });
    }),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return { sessionGate, messagesGate, onSwitchThread };
}

function observeEmptyPrompt() {
  let drawn = false;
  const observer = new MutationObserver(records => {
    drawn ||= records.some(record =>
      Array.from(record.addedNodes).some(node => node.textContent?.includes('What can I help you build?')),
    );
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return { wasDrawn: () => drawn, disconnect: () => observer.disconnect() };
}

function renderThreadRoute(path = `/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`) {
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage loading shell', () => {
  it('keeps the sidebar mounted with a main-slot spinner while the session resolves, then shows the thread', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute();
    messagesGate.resolve();
    renderThreadRoute();

    expect(await screen.findByLabelText('Loading session')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'User sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New user session' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Thread composer' })).not.toBeInTheDocument();

    sessionGate.resolve();
    expect(await screen.findByRole('region', { name: 'Thread composer' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Loading session')).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'User sessions' })).toBeInTheDocument();
  });

  it('keeps the session header and its workspace toggle mounted while thread messages load', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute();
    renderThreadRoute();
    sessionGate.resolve();

    const header = await screen.findByRole('region', { name: 'Factory session' });
    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Workspace files' })).toBeInTheDocument();

    messagesGate.resolve();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Factory session' })).toBeInTheDocument();
  });

  it('reveals loaded history without briefly rendering the empty thread state', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({ messages: assistantOnlyThreadMessages });
    const { client } = renderThreadRoute();
    sessionGate.resolve();
    await screen.findByRole('status', { name: 'Preparing session' });

    const emptyPrompt = observeEmptyPrompt();

    messagesGate.resolve();
    await screen.findByText('There are no user turns in this thread.');
    await waitForMutationsIdle(client);
    emptyPrompt.disconnect();

    expect(emptyPrompt.wasDrawn()).toBe(false);
  });

  it('joins a run mid-step with what it has streamed so far, never the empty prompt', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({
      sessionState: { running: true },
      streamed: [
        sessionSnapshot(
          [initiatingMessage, checkoutMessage],
          {
            isRunning: true,
            activeTools: {
              'call-1': {
                name: 'execute_command',
                args: checkoutArgs,
                status: 'running',
                shellOutput: 'Fetching origin\n',
              },
            },
          },
          checkoutMessage.id,
        ),
      ],
    });
    const { client } = renderThreadRoute();
    const emptyPrompt = observeEmptyPrompt();
    sessionGate.resolve();
    messagesGate.resolve();

    const checkout = await screen.findByRole('group', { name: 'Tool: execute_command' }, { timeout: 4000 });
    await waitForMutationsIdle(client);
    emptyPrompt.disconnect();

    expect(checkout).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(initiatingPayload.contents)).toBeInTheDocument();
    expect(document.body).toHaveTextContent('Checking out the pull request.');
    expect(emptyPrompt.wasDrawn()).toBe(false);
    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();

    await userEvent.setup().click(within(checkout).getByRole('button', { expanded: false }));
    expect(await within(checkout).findByText('Fetching origin')).toBeInTheDocument();
  });

  it('shows buffered tool arguments while the input is still streaming', async () => {
    const bufferedInput = '{"command":"gh pr checkout';
    const { sessionGate, messagesGate } = stubThreadRoute({
      sessionState: { running: true },
      streamed: [
        sessionSnapshot([initiatingMessage], {
          isRunning: true,
          activeTools: { 'call-1': { name: 'execute_command', args: {}, status: 'streaming_input' } },
          toolInputBuffers: { 'call-1': { toolName: 'execute_command', text: bufferedInput } },
        }),
      ],
    });
    renderThreadRoute();
    sessionGate.resolve();
    messagesGate.resolve();

    const checkout = await screen.findByRole('group', { name: 'Tool: execute_command' }, { timeout: 4000 });
    await userEvent.setup().click(within(checkout).getByRole('button', { expanded: false }));
    expect(await within(checkout).findByText(bufferedInput)).toBeInTheDocument();
  });

  it('restores the approval required to continue a run opened mid-step', async () => {
    const approval = { toolCallId: 'call-1', toolName: 'execute_command', args: checkoutArgs };
    const { sessionGate, messagesGate } = stubThreadRoute({
      sessionState: { running: true },
      streamed: [sessionSnapshot([initiatingMessage, checkoutMessage], { isRunning: true, pendingApproval: approval })],
    });
    const onApprove = vi.fn();
    server.use(
      http.post(`${AC}/sessions/${SESSION_ID}/tool-approval`, async ({ request }) => {
        onApprove(await request.json());
        return HttpResponse.json({ ok: true });
      }),
    );
    const { client } = renderThreadRoute();
    sessionGate.resolve();
    messagesGate.resolve();

    const approve = await screen.findByRole('button', { name: 'Approve execute_command' });
    await userEvent.setup().click(approve);
    await waitForMutationsIdle(client);

    expect(onApprove).toHaveBeenCalledWith({ toolCallId: 'call-1', approved: true });
    expect(screen.queryByRole('group', { name: 'Tool approval for execute_command' })).not.toBeInTheDocument();
  });

  it('shows the run thinking, never the empty prompt, while a joined run has streamed nothing yet', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({
      sessionState: { running: true },
      streamed: [sessionSnapshot([], { isRunning: true })],
    });
    const { client } = renderThreadRoute();
    const emptyPrompt = observeEmptyPrompt();
    sessionGate.resolve();
    messagesGate.resolve();

    expect(await screen.findByText('Thinking')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    emptyPrompt.disconnect();

    expect(emptyPrompt.wasDrawn()).toBe(false);
  });

  it('reveals the complete loaded transcript when preparation finishes', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({ messages: threadRailMessagesWithEcho });
    renderThreadRoute();
    sessionGate.resolve();
    await screen.findByRole('status', { name: 'Preparing session' });

    messagesGate.resolve();
    await screen.findByText('Run the focused checks');

    expect(screen.getByText('Review the implementation plan')).toBeInTheDocument();
    expect(document.body).toHaveTextContent('The implementation is ready to review.');
    expect(screen.queryByRole('status', { name: 'Preparing session' })).not.toBeInTheDocument();
  });

  it('waits for sandbox readiness before synchronizing an existing route thread', async () => {
    const { sessionGate, onSwitchThread } = stubThreadRoute({
      initialThreadId: 'thread-1',
      threads: [{ id: 'thread-1' }, { id: ROUTE_THREAD_ID }],
    });
    renderThreadRoute(`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${ROUTE_THREAD_ID}`);

    expect(await screen.findByRole('status', { name: 'Preparing session' })).toBeInTheDocument();
    expect(onSwitchThread).not.toHaveBeenCalled();

    sessionGate.resolve();
    await waitFor(() => expect(onSwitchThread).toHaveBeenCalledWith(ROUTE_THREAD_ID));
  });
});
