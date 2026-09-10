/**
 * Opening a session clears its unread dot.
 *
 * The dot is driven purely by attention read receipts, and before this suite
 * nothing on a session route ever wrote one — only the attention popover and
 * the inbox did, so a dot a session earned survived every visit to it. These
 * tests drive the real route tree and assert the receipts the visit posts.
 */
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { attentionKindSummaries } from '../../../../e2e/ui/attention';
import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { FactoryAttentionItem } from '../../domains/factory/services/attention';
import { createAppRoutes } from '../../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'ghp-1';
const SESSION_ID = 'sess-1';
const OTHER_SESSION_ID = 'sess-2';
const AC = `${TEST_BASE_URL}/api/agent-controller/code`;

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
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function dbMessage(id: string, role: MastraDBMessage['role'], text: string): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date('2026-07-23T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

function waitingOn(sessionId: string, overrides: Partial<FactoryAttentionItem> = {}): FactoryAttentionItem {
  return {
    kind: 'agent-waiting',
    key: `agent-waiting:${sessionId}`,
    occurrence: 1,
    workItemId: null,
    title: 'Waiting on you',
    detail: 'Agent is waiting for an answer',
    occurredAt: '2026-07-23T00:00:00.000Z',
    read: false,
    archived: false,
    target: { kind: 'thread', sessionId, threadId: sessionId },
    sessionId,
    threadId: sessionId,
    role: 'work',
    toolName: 'ask_user',
    ...overrides,
  } as FactoryAttentionItem;
}

interface ReceiptStub {
  /** Every `read` receipt the app posted, in order, as `<kind>:<sourceId>`. */
  posted: string[];
  status?: number;
}

function stubThreadRoute(attention: FactoryAttentionItem[], receipts: ReceiptStub) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention`, () =>
      HttpResponse.json({ items: attention, kinds: attentionKindSummaries(attention), hasMore: false }),
    ),
    http.post(
      `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/attention/:kind/:sourceId/:occurrence/read`,
      ({ params }) => {
        receipts.posted.push(`${String(params.kind)}:${String(params.sourceId)}`);
        if (receipts.status === 409) {
          return HttpResponse.json({ error: 'attention_item_not_current' }, { status: 409 });
        }
        return HttpResponse.json({
          receipt: {
            key: `k:${String(params.sourceId)}`,
            state: 'read',
            readAt: '2026-07-23T00:00:00.000Z',
            archivedAt: null,
          },
        });
      },
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/sessions`, () =>
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
        settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
      }),
    ),
    http.post(`${AC}/sessions/:resourceId/thread`, () => HttpResponse.json({ ok: true })),
    http.put(`${AC}/sessions/:resourceId/state`, () => HttpResponse.json({ ok: true })),
    http.get(
      `${AC}/sessions/:resourceId/stream`,
      () =>
        new Response(new ReadableStream<Uint8Array>({ start() {}, cancel() {} }), {
          headers: { 'content-type': 'text/event-stream' },
        }),
    ),
    http.get(`${AC}/sessions/:resourceId/permissions`, () => HttpResponse.json({})),
    http.get(`${AC}/sessions/:resourceId/threads`, () => HttpResponse.json({ threads: [{ id: SESSION_ID }] })),
    http.get(`${AC}/sessions/:resourceId/threads/:threadId/messages`, () =>
      HttpResponse.json({ messages: [dbMessage('kickoff', 'user', 'review this PR')] }),
    ),
    http.get(`${AC}/modes`, () => HttpResponse.json({ modes: [] })),
    http.get(`${TEST_BASE_URL}/web/workspace/rendered/list`, () =>
      HttpResponse.json({ workspacePath: `/ws/${SESSION_ID}`, root: '.artifacts', rootPath: '', entries: [] }),
    ),
  );
}

const THREAD_PATH = `/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${SESSION_ID}`;

async function openThread(attention: FactoryAttentionItem[], status?: number) {
  const receipts: ReceiptStub = { posted: [], status };
  stubThreadRoute(attention, receipts);
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [THREAD_PATH] });
  const { client } = renderWithProviders(<RouterProvider router={router} />);
  expect(await screen.findByText('review this PR')).toBeInTheDocument();
  await waitForMutationsIdle(client);
  return { receipts, client, router };
}

describe('ThreadPage attention read-on-open', () => {
  it('marks the opened session read and leaves other sessions alone', async () => {
    const { receipts } = await openThread([waitingOn(SESSION_ID), waitingOn(OTHER_SESSION_ID)]);

    await waitFor(() => expect(receipts.posted).toEqual([`agent-waiting:${SESSION_ID}`]));
  });

  it('posts once, not again when the attention poll refetches', async () => {
    const { receipts, client } = await openThread([waitingOn(SESSION_ID)]);

    await waitFor(() => expect(receipts.posted).toHaveLength(1));

    // The receipt invalidates the attention root and the query polls on its own
    // cadence; neither may re-fire the sweep for a session already swept.
    await client.invalidateQueries();
    await waitForMutationsIdle(client);

    expect(receipts.posted).toEqual([`agent-waiting:${SESSION_ID}`]);
  });

  it('posts nothing when the session owes no unread attention', async () => {
    const { receipts } = await openThread([waitingOn(SESSION_ID, { read: true })]);

    expect(receipts.posted).toEqual([]);
  });

  it('stays silent when the park resumed before the receipt landed', async () => {
    // The endpoint answers 409 `attention_item_not_current` for a park the live
    // registry has moved past. A receipt nobody asked for must not raise an error.
    const { receipts } = await openThread([waitingOn(SESSION_ID)], 409);

    await waitFor(() => expect(receipts.posted).toHaveLength(1));
    expect(screen.getByText('review this PR')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sweeps every unread item the opened session owes', async () => {
    const { receipts } = await openThread([
      waitingOn(SESSION_ID),
      waitingOn(SESSION_ID, {
        kind: 'mention',
        key: 'mention:c1',
        commentId: '11111111-1111-4111-8111-111111111111',
        authorId: 'user-2',
      } as Partial<FactoryAttentionItem>),
    ]);

    await waitFor(() => expect(receipts.posted).toHaveLength(2));
    expect(receipts.posted).toContain(`agent-waiting:${SESSION_ID}`);
    expect(receipts.posted).toContain('mention:11111111-1111-4111-8111-111111111111');
  });
});
