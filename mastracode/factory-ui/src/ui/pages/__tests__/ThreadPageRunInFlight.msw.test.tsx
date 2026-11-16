import type { QueryClient } from '@tanstack/react-query';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { listedRepository } from '../../../../e2e/ui/factory-projects';
import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { HIDDEN_STREAM_GRACE_MS } from '../../lib/hooks/useDocumentVisible';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;
const THREAD_PATH = `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`;
const CREATED_AT = new Date('2026-11-16T03:16:20.000Z');

const userSession = {
  id: 'row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPO_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/pr-1',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-11-16T03:00:00.000Z',
  updatedAt: '2026-11-16T03:00:00.000Z',
};

interface Tool {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

const viewPullRequest: Tool = { id: 'toolu_view', name: 'execute_command', args: { command: 'gh pr view 30471' } };
const reviewSource: Tool = { id: 'toolu_review', name: 'factory_review_source', args: { changeRequestId: '30471' } };
const crossCheck: Tool = { id: 'toolu_cross', name: 'execute_command', args: { command: 'git log --format=%an' } };
const writeNotes: Tool = { id: 'toolu_write', name: 'write_file', args: { path: 'review.md', content: 'notes' } };
const postComment: Tool = {
  id: 'toolu_comment',
  name: 'source_control_comment_change_request',
  args: { changeRequestId: '30471', body: 'Looks good' },
};

const CALLS_BEFORE_THE_COMMENT = ['Tool: factory_review_source', 'Tool: execute_command', 'Tool: write_file'];

function toolPart(tool: Tool, state: 'call' | 'result'): MastraMessagePart {
  return {
    type: 'tool-invocation',
    toolInvocation:
      state === 'call'
        ? { state, toolCallId: tool.id, toolName: tool.name, args: tool.args }
        : { state, toolCallId: tool.id, toolName: tool.name, args: tool.args, result: 'ok' },
  };
}

// Storage keeps step-start and workspace data parts the stream never sends; the stream indexes live parts only.
function runOnServer() {
  const encoder = new TextEncoder();
  const stored: MastraDBMessage[] = [];
  let live: MastraDBMessage | null = null;
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;

  const write = (event: { type: string; [key: string]: unknown }) =>
    stream?.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  const snapshot = () =>
    write({ type: 'display_state_changed', displayState: { isRunning: true, currentMessage: live } });
  const send = (event: { type: string; [key: string]: unknown }) => {
    write(event);
    snapshot();
  };

  const rowInFlight = () => {
    const storedRow = stored.find(message => message.id === live?.id);
    if (!live || !storedRow) throw new Error('No row in flight');
    return { live, stored: storedRow };
  };

  const callTool = (tool: Tool) => {
    const row = rowInFlight();
    const index = row.live.content.parts.length;
    row.stored.content.parts.push({ type: 'step-start' }, toolPart(tool, 'call'));
    row.live.content.parts.push(toolPart(tool, 'call'));
    send({ type: 'tool_input_start', toolCallId: tool.id, toolName: tool.name, messageId: row.live.id });
    send({ type: 'message_update', id: row.live.id, event: { type: 'part', index, part: toolPart(tool, 'call') } });
    send({ type: 'tool_start', toolCallId: tool.id, toolName: tool.name, args: tool.args });
    return index;
  };

  server.use(
    http.get(`${AC}/sessions/:resourceId/stream`, ({ request }) => {
      request.signal.addEventListener('abort', () => {
        stream = undefined;
      });
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller;
            snapshot();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    }),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, ({ params }) =>
      HttpResponse.json({ messages: structuredClone(stored.filter(message => message.threadId === params.threadId)) }),
    ),
  );

  return {
    get streaming() {
      return stream !== undefined;
    },
    startRow(id: string, text: string, threadId = SESSION_ID) {
      live = {
        id,
        role: 'assistant',
        createdAt: CREATED_AT,
        threadId,
        content: { format: 2, parts: [{ type: 'text', text }] },
      };
      stored.push(structuredClone(live));
      send({ type: 'message_start', message: structuredClone(live) });
    },
    say(delta: string) {
      const row = rowInFlight();
      const at = row.live.content.parts.findLastIndex(part => part.type === 'text');
      const part = row.live.content.parts[at];
      if (part?.type !== 'text') throw new Error('No text to grow');
      row.live.content.parts[at] = { ...part, text: part.text + delta };
      send({ type: 'message_update', id: row.live.id, event: { type: 'text-delta', delta } });
    },
    callTool,
    runTool(tool: Tool) {
      const index = callTool(tool);
      const row = rowInFlight();
      row.stored.content.parts.splice(
        -1,
        1,
        toolPart(tool, 'result'),
        { type: 'data-workspace-metadata', data: { cwd: '/repo' } } as MastraMessagePart,
        { type: 'data-sandbox-exit', data: { toolCallId: tool.id, exitCode: 0 } } as MastraMessagePart,
      );
      row.live.content.parts[index] = toolPart(tool, 'result');
      send({ type: 'message_update', id: row.live.id, event: { type: 'part', index, part: toolPart(tool, 'result') } });
      send({ type: 'tool_end', toolCallId: tool.id, result: 'ok', isError: false });
    },
  };
}

type Run = ReturnType<typeof runOnServer>;

function stubThreadRoute() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}`, () =>
      HttpResponse.json({ project: { id: FACTORY_ID, name: 'Acme Factory', defaultModelId: 'openai/gpt-4o-mini' } }),
    ),
    http.get(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/feed-events`,
      () => new Response(new ReadableStream<Uint8Array>(), { headers: { 'content-type': 'text/event-stream' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/default-model`, () =>
      HttpResponse.json({ modelId: null, thinkingLevel: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [userSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/subscriptions`, () => HttpResponse.json({ subscriptions: [] })),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () => HttpResponse.json({ session: userSession })),
    http.post(`${AC}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: SESSION_ID, threadId: SESSION_ID }),
    ),
    http.get(`${AC}/sessions/:resourceId`, () =>
      HttpResponse.json({
        controllerId: 'code',
        resourceId: SESSION_ID,
        modeId: 'build',
        modelId: 'openai/gpt-4o-mini',
        threadId: SESSION_ID,
        running: true,
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.post(`${AC}/sessions/:resourceId/thread`, () => HttpResponse.json({ ok: true })),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [{ id: SESSION_ID }] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );
}

function setTabVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function openThread(run: Run) {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [THREAD_PATH] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  await waitForMutationsIdle(client);
  await waitFor(() => expect(run.streaming).toBe(true));
  return client;
}

async function leaveTab(run: Run) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  act(() => setTabVisibility('hidden'));
  act(() => vi.advanceTimersByTime(HIDDEN_STREAM_GRACE_MS));
  await waitFor(() => expect(run.streaming).toBe(false));
  vi.useRealTimers();
}

async function comeBackToTab(run: Run, client: QueryClient) {
  act(() => setTabVisibility('visible'));
  await waitFor(() => expect(run.streaming).toBe(true));
  await waitForMutationsIdle(client);
}

async function expectLineListing(name: RegExp, calls: string[]) {
  const line = await screen.findByRole('group', { name });
  await userEvent.click(within(line).getAllByRole('button')[0]);
  await waitFor(() =>
    expect(
      within(line)
        .queryAllByRole('group', { name: /^Tool: / })
        .map(call => call.getAttribute('aria-label')),
    ).toEqual(calls),
  );
}

describe('ThreadPage joining a run in flight', () => {
  afterEach(() => {
    vi.useRealTimers();
    setTabVisibility('visible');
  });

  it('draws each call once when the tab comes back to a reply that began while it was away', async () => {
    stubThreadRoute();
    const run = runOnServer();
    const client = await openThread(run);
    run.startRow('row-before', 'Meanwhile, existing review signal.');
    run.runTool(viewPullRequest);
    await screen.findByText('Meanwhile, existing review signal.');

    await leaveTab(run);
    run.startRow('row-now', 'Now cross-check provenance.');
    run.runTool(reviewSource);
    run.runTool(crossCheck);
    run.runTool(writeNotes);
    await comeBackToTab(run, client);
    run.callTool(postComment);

    await expectLineListing(/^Posting comment/, CALLS_BEFORE_THE_COMMENT);
  });

  it('shows the calls a streaming reply made while the tab was away', async () => {
    stubThreadRoute();
    const run = runOnServer();
    const client = await openThread(run);
    run.startRow('row-now', 'Now cross-check provenance.');
    run.runTool(reviewSource);
    await screen.findByText('Now cross-check provenance.');

    await leaveTab(run);
    run.runTool(crossCheck);
    run.runTool(writeNotes);
    await comeBackToTab(run, client);
    run.callTool(postComment);

    await expectLineListing(/^Posting comment/, CALLS_BEFORE_THE_COMMENT);
  });

  it('draws each call once when the thread opens on a reply in flight', async () => {
    stubThreadRoute();
    const run = runOnServer();
    run.startRow('row-now', 'Now cross-check provenance.');
    run.runTool(reviewSource);
    run.runTool(crossCheck);
    run.runTool(writeNotes);

    await openThread(run);
    run.callTool(postComment);

    await expectLineListing(/^Posting comment/, CALLS_BEFORE_THE_COMMENT);
  });

  it('keeps the words a reply wrote while the tab was away', async () => {
    stubThreadRoute();
    const run = runOnServer();
    const client = await openThread(run);
    run.startRow('row-now', 'Checking');
    await screen.findByText('Checking');

    await leaveTab(run);
    run.say(' the authors');
    await comeBackToTab(run, client);
    run.say(' now.');

    expect(await screen.findByText('Checking the authors now.')).toBeInTheDocument();
  });

  it('leaves out a reply in flight on another thread of the session', async () => {
    stubThreadRoute();
    const run = runOnServer();
    run.startRow('row-elsewhere', 'Working on the other thread.', 'thread-other');

    await openThread(run);
    run.startRow('row-here', 'Working on this thread.');
    await screen.findByText('Working on this thread.');

    expect(screen.queryByText('Working on the other thread.')).not.toBeInTheDocument();
  });
});
