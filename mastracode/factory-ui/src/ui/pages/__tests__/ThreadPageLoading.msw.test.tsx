import type { AgentControllerEvent, AgentControllerThreadInfo, MastraDBMessage } from '@mastra/client-js';
import { ChunkFrom } from '@mastra/core/stream';
import type { ChunkType, DataChunkType } from '@mastra/core/stream';
import { act, screen, waitFor, within } from '@testing-library/react';
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
    parts: [{ type: 'text', text: initiatingPayload.contents }],
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

type StreamFrame = AgentControllerEvent | { type: 'thread_chunk'; chunk: ChunkType | DataChunkType };
const run = { runId: 'checkout-run', from: ChunkFrom.AGENT };
const checkoutChunks: (ChunkType | DataChunkType)[] = [
  { ...run, type: 'start', payload: { messageId: checkoutMessage.id } },
  { type: 'data-user-message', data: initiatingPayload },
  { ...run, type: 'step-start', payload: { messageId: checkoutMessage.id, request: {} } },
  { ...run, type: 'text-start', payload: { id: 'checkout-text' } },
  { ...run, type: 'text-delta', payload: { id: 'checkout-text', text: 'Checking out the pull request.' } },
  { ...run, type: 'text-end', payload: { id: 'checkout-text' } },
  {
    ...run,
    type: 'tool-call',
    payload: {
      toolCallId: 'call-1',
      toolName: 'execute_command',
      args: { ...checkoutArgs, __mastraMetadata: undefined },
    },
  },
];
function threadFrames(chunks: (ChunkType | DataChunkType)[]): StreamFrame[] {
  return chunks.map(chunk => ({ type: 'thread_chunk', chunk }));
}

function stubThreadRoute({
  initialThreadId = SESSION_ID,
  threads = [],
  messages = [],
  sessionState = {},
  streamed = [],
}: {
  initialThreadId?: string;
  threads?: AgentControllerThreadInfo[];
  messages?: MastraDBMessage[];
  sessionState?: Record<string, unknown>;
  streamed?: StreamFrame[];
} = {}) {
  const sessionGate = deferred();
  const messagesGate = deferred();
  const encoder = new TextEncoder();
  const onStream = vi.fn();
  const onReadMessages = vi.fn();
  let currentStream: ReadableStreamDefaultController<Uint8Array> | undefined;
  function emit(event: StreamFrame) {
    if (!currentStream) throw new Error('The session stream has not connected');
    currentStream.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }
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
              currentStream = controller;
              onStream();
              for (const event of streamed) emit(event);
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
      onReadMessages();
      return HttpResponse.json({ messages });
    }),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );

  return {
    sessionGate,
    messagesGate,
    onSwitchThread,
    onStream,
    onReadMessages,
    emit,
    disconnect: () => currentStream?.close(),
  };
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

  it('joins a blocked tool through buffered chunks and reconciles replay with persisted history', async () => {
    const messages: MastraDBMessage[] = [];
    const streamed = threadFrames(checkoutChunks);
    const sessionState = { running: true };
    const { sessionGate, messagesGate, onStream, onReadMessages, disconnect } = stubThreadRoute({
      messages,
      sessionState,
      streamed,
    });
    const { client } = renderThreadRoute();
    const emptyPrompt = observeEmptyPrompt();
    sessionGate.resolve();
    messagesGate.resolve();

    const checkout = await screen.findByRole('group', { name: 'Tool: execute_command' }, { timeout: 5000 });
    await waitForMutationsIdle(client);
    emptyPrompt.disconnect();
    expect(checkout).toHaveAttribute('aria-busy', 'true');
    const prompt = screen.getByText(initiatingPayload.contents);
    const response = await screen.findByText('Checking out the pull request.', {}, { timeout: 5000 });
    expect(prompt.compareDocumentPosition(response) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector(`time[datetime="${initiatingPayload.createdAt}"]`)).toBeInTheDocument();
    expect(document.body).toHaveTextContent('Checking out the pull request.');
    expect(within(checkout).getByText(checkoutArgs.command)).toBeInTheDocument();
    expect(emptyPrompt.wasDrawn()).toBe(false);

    streamed.push(
      ...threadFrames([
        { ...run, type: 'text-start', payload: { id: 'waiting-text' } },
        { ...run, type: 'text-delta', payload: { id: 'waiting-text', text: 'Waiting for checkout to finish.' } },
      ]),
    );
    act(disconnect);
    await waitFor(() => expect(onStream).toHaveBeenCalledTimes(2), { timeout: 5000 });
    await screen.findByText('Waiting for checkout to finish.', {}, { timeout: 5000 });
    await waitForMutationsIdle(client);
    expect(screen.getAllByRole('group', { name: 'Tool: execute_command' })).toHaveLength(1);
    expect(screen.getAllByText(initiatingPayload.contents)).toHaveLength(1);
    expect(screen.getAllByText('Checking out the pull request.')).toHaveLength(1);

    messages.push(initiatingMessage, {
      ...checkoutMessage,
      content: {
        format: 2,
        parts: [
          { type: 'text', text: 'Checking out the pull request.' },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'execute_command',
              args: checkoutArgs,
              result: 'Checked out',
            },
          },
          { type: 'text', text: 'Waiting for checkout to finish.' },
          { type: 'text', text: ' Ready for review.' },
        ],
      },
    });
    const historyReadsBeforeCompletion = onReadMessages.mock.calls.length;
    streamed.length = 0;
    sessionState.running = false;
    act(disconnect);
    await waitFor(() => expect(onStream).toHaveBeenCalledTimes(3), { timeout: 5000 });
    await waitFor(() => expect(onReadMessages.mock.calls.length).toBeGreaterThan(historyReadsBeforeCompletion));
    await waitForMutationsIdle(client);
    await waitFor(() => expect(document.body.textContent).toContain('Ready for review.'), { timeout: 5000 });
    expect(document.body.textContent?.match(/Checking out the pull request\./g)).toHaveLength(1);
    expect(screen.getAllByText(initiatingPayload.contents)).toHaveLength(1);
    expect(screen.getAllByRole('group', { name: 'Tool: execute_command' })).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Tool: execute_command' })).toHaveAttribute('aria-busy', 'false');
  });

  it('restores the approval required to continue a run opened mid-step', async () => {
    const approval = { toolCallId: 'call-1', toolName: 'execute_command', args: checkoutArgs };
    const { sessionGate, messagesGate } = stubThreadRoute({
      sessionState: { running: true },
      streamed: threadFrames([
        ...checkoutChunks,
        { ...run, type: 'tool-call-approval', payload: { ...approval, resumeSchema: '{}' } },
      ]),
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

    await waitForMutationsIdle(client);
    const approve = await screen.findByRole('button', { name: 'Approve execute_command' });
    await userEvent.setup().click(approve);
    await waitForMutationsIdle(client);

    expect(onApprove).toHaveBeenCalledWith({ toolCallId: 'call-1', approved: true });
    expect(screen.queryByRole('group', { name: 'Tool approval for execute_command' })).not.toBeInTheDocument();
  });

  it('shows the run thinking, never the empty prompt, while a joined run has streamed nothing yet', async () => {
    const { sessionGate, messagesGate } = stubThreadRoute({
      sessionState: { running: true },
      streamed: threadFrames([{ ...run, type: 'start', payload: { messageId: 'waiting-message' } }]),
    });
    const { client } = renderThreadRoute();
    const emptyPrompt = observeEmptyPrompt();
    sessionGate.resolve();
    messagesGate.resolve();

    await waitForMutationsIdle(client);
    await waitFor(() => expect(screen.getByText('Thinking')).toBeInTheDocument());
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
