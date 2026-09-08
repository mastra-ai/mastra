import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { FeedEventsProvider, useFeedEventsConnected } from '../../ui/domains/factory/context/FeedEventsProvider';
import type { WorkItemComment, WorkItemCommentPage } from '../../ui/domains/factory/services/commentsWire';
import {
  FEED_FALLBACK_POLL_MS,
  useCreateWorkItemCommentMutation,
  useDeleteWorkItemCommentMutation,
  useEditWorkItemCommentMutation,
  usePendingCommentCreates,
  useWorkItemComments,
} from '../useWorkItemComments';
import { useWorkItemsQuery } from '../useWorkItems';

const PROJECT_ID = 'project-1';
const ITEM_ID = 'item-1';
const COMMENTS_URL = `${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}/comments`;
const BOARD_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
/** One fallback tick plus room for the request to land. */
const PAST_ONE_POLL_MS = FEED_FALLBACK_POLL_MS + 2_000;

function wireComment(id: string, body: string): WorkItemComment {
  return {
    id,
    workItemId: ITEM_ID,
    kind: 'comment',
    bodyFormat: 'markdown',
    body,
    author: { kind: 'user', id: 'user-1', displayName: 'Ada' },
    mentions: [],
    occurredAt: '2026-08-26T10:00:00.000Z',
    revision: 1,
  };
}

function wireBoardItem(feedActivityAt: string | null) {
  return {
    id: ITEM_ID,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: PROJECT_ID,
    externalSource: null,
    parentWorkItemId: null,
    title: 'Card',
    stages: ['triage'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    commentCount: 1,
    feedActivityAt,
    revision: 1,
    createdAt: '2026-08-26T00:00:00.000Z',
    updatedAt: '2026-08-26T00:00:00.000Z',
  };
}

function firstPageComments(data: { pages: WorkItemCommentPage[] } | undefined): string[] {
  return (data?.pages ?? []).flatMap(page => page.comments.map(comment => comment.body));
}

function useFeedFromBoard() {
  // Production wiring: the board query flows on its own 5s poll alongside the feed.
  useWorkItemsQuery(PROJECT_ID);
  return useWorkItemComments({ workItemId: ITEM_ID });
}

describe('useWorkItemComments', () => {
  it('loads newest-first pages and passes the cursor on fetchNextPage', async () => {
    const requested: string[] = [];
    server.use(
      http.get(COMMENTS_URL, ({ request }) => {
        const before = new URL(request.url).searchParams.get('before');
        requested.push(before ?? 'first');
        if (before === 'cursor-1') return HttpResponse.json({ comments: [wireComment('c1', 'oldest')] });
        return HttpResponse.json({
          comments: [wireComment('c3', 'newest'), wireComment('c2', 'middle')],
          nextCursor: 'cursor-1',
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkItemComments({ workItemId: ITEM_ID }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(firstPageComments(result.current.data)).toEqual(['newest', 'middle']);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(firstPageComments(result.current.data)).toEqual(['newest', 'middle', 'oldest']));
    expect(requested).toEqual(['first', 'cursor-1']);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('makes no request while disabled', async () => {
    let requests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        requests += 1;
        return HttpResponse.json({ comments: [] });
      }),
    );

    renderHookWithProviders(() => useWorkItemComments({ workItemId: ITEM_ID, enabled: false }));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(requests).toBe(0);
  });

  it('shares one cache entry between two mounts', async () => {
    let requests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        requests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello')] });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      panel: useWorkItemComments({ workItemId: ITEM_ID }),
      thread: useWorkItemComments({ workItemId: ITEM_ID }),
    }));
    await waitFor(() => expect(result.current.panel.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.thread.isSuccess).toBe(true));
    expect(requests).toBe(1);
    expect(result.current.thread.data).toBe(result.current.panel.data);
  });

  it('never refetches off the board poll, whatever feedActivityAt does', async () => {
    let commentRequests = 0;
    let feedActivityAt = '2026-08-26T10:00:00.000Z';
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello')] });
      }),
      http.get(BOARD_URL, () =>
        HttpResponse.json({ workItems: [wireBoardItem(feedActivityAt)], runningSessionIds: [] }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => useFeedFromBoard());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitForMutationsIdle(client);
    expect(commentRequests).toBe(1);

    feedActivityAt = '2026-08-26T10:00:05.000Z';
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.workItems(PROJECT_ID) });
    });
    await waitForMutationsIdle(client);
    expect(commentRequests).toBe(1);
  });

  it('polls its own fallback interval with no feed stream mounted', async () => {
    let commentRequests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello')] });
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkItemComments({ workItemId: ITEM_ID }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(commentRequests).toBe(1);

    await waitFor(() => expect(commentRequests).toBeGreaterThan(1), { timeout: PAST_ONE_POLL_MS });
  });

  it('drops the fallback interval while the feed stream is connected', async () => {
    let commentRequests = 0;
    server.use(
      http.get(COMMENTS_URL, () => {
        commentRequests += 1;
        return HttpResponse.json({ comments: [wireComment('c1', 'hello')] });
      }),
    );

    const { result, client } = renderHookWithProviders(
      () => ({
        comments: useWorkItemComments({ workItemId: ITEM_ID }),
        connected: useFeedEventsConnected(),
      }),
      {
        inner: ({ children }) => <FeedEventsProvider factoryProjectId={PROJECT_ID}>{children}</FeedEventsProvider>,
      },
    );
    await waitFor(() => expect(result.current.comments.isSuccess).toBe(true));
    // The interval is gated on connected state, so the quiet window only
    // starts once the stream reports connected.
    await waitFor(() => expect(result.current.connected).toBe(true));
    await waitForMutationsIdle(client);

    const settled = commentRequests;
    await new Promise(resolve => setTimeout(resolve, PAST_ONE_POLL_MS));
    expect(commentRequests).toBe(settled);
  });
});

describe('useCreateWorkItemCommentMutation', () => {
  it('holds the send in mutation state, then lands the stored row without waiting for the refetch', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    let releaseRefetch!: () => void;
    const refetchGate = new Promise<void>(resolve => {
      releaseRefetch = resolve;
    });
    let commentRequests = 0;
    let boardRequests = 0;
    let feedActivityAt = '2026-08-26T10:00:00.000Z';
    const serverComments: WorkItemComment[] = [wireComment('c1', 'hello')];
    server.use(
      http.get(COMMENTS_URL, async () => {
        commentRequests += 1;
        // Every read after the send is held open, so a row on screen can only
        // have come from the create response.
        if (commentRequests > 1) await refetchGate;
        return HttpResponse.json({ comments: [...serverComments] });
      }),
      http.get(BOARD_URL, () => {
        boardRequests += 1;
        return HttpResponse.json({ workItems: [wireBoardItem(feedActivityAt)], runningSessionIds: [] });
      }),
      http.post(COMMENTS_URL, async () => {
        await responseGate;
        serverComments.unshift({ ...wireComment('c2', 'brand new'), clientToken: 'token-1' });
        feedActivityAt = '2026-08-26T10:00:10.000Z';
        return HttpResponse.json({ comment: serverComments[0] }, { status: 201 });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      comments: useFeedFromBoard(),
      create: useCreateWorkItemCommentMutation({ workItemId: ITEM_ID, factoryProjectId: PROJECT_ID }),
      pending: usePendingCommentCreates(ITEM_ID),
    }));
    await waitFor(() => expect(result.current.comments.isSuccess).toBe(true));
    await waitForMutationsIdle(client);
    const requestsBeforeCreate = { comments: commentRequests, board: boardRequests };

    act(() => {
      result.current.create.mutate({ body: 'brand new', clientToken: 'token-1' });
    });
    await waitFor(() =>
      expect(result.current.pending).toEqual([
        { input: { body: 'brand new', clientToken: 'token-1' }, submittedAt: expect.any(Number) },
      ]),
    );
    // No optimistic cache write: a poll tick mid-flight must not race a fake row.
    expect(firstPageComments(result.current.comments.data)).toEqual(['hello']);

    releaseResponse();
    // The settled create pulls its own row back without waiting on the stream.
    await waitFor(() => expect(firstPageComments(result.current.comments.data)).toEqual(['brand new', 'hello']));

    // The settled mutation invalidates only the board; its bumped
    // feedActivityAt drives the single comments refetch, which reconciles the
    // row that is already on screen.
    releaseRefetch();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(commentRequests).toBe(requestsBeforeCreate.comments + 1));
    expect(firstPageComments(result.current.comments.data)).toEqual(['brand new', 'hello']);
    expect(boardRequests).toBe(requestsBeforeCreate.board + 1);
    // The succeeded create still shows as a row source; the list dedups it
    // against the landed server row by clientToken.
    expect(result.current.pending).toEqual([
      { input: { body: 'brand new', clientToken: 'token-1' }, submittedAt: expect.any(Number) },
    ]);
  });
});

describe('useEditWorkItemCommentMutation', () => {
  it('patches the row optimistically and rolls back when the server rejects', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [wireComment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, async () => {
        await responseGate;
        return HttpResponse.json({ error: 'nope' }, { status: 500 });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      comments: useWorkItemComments({ workItemId: ITEM_ID }),
      edit: useEditWorkItemCommentMutation({ workItemId: ITEM_ID, factoryProjectId: undefined }),
    }));
    await waitFor(() => expect(result.current.comments.isSuccess).toBe(true));

    act(() => {
      result.current.edit.mutate({ commentId: 'c1', input: { body: 'edited' } });
    });
    await waitFor(() => expect(firstPageComments(result.current.comments.data)).toEqual(['edited']));

    releaseResponse();
    await waitForMutationsIdle(client);
    expect(result.current.edit.isError).toBe(true);
    expect(firstPageComments(result.current.comments.data)).toEqual(['original']);
  });

  it('replaces the row with the server response on success, so the next edit sends the fresh revision', async () => {
    server.use(
      http.get(COMMENTS_URL, () => HttpResponse.json({ comments: [wireComment('c1', 'original')] })),
      http.patch(`${COMMENTS_URL}/c1`, () =>
        HttpResponse.json({
          comment: { ...wireComment('c1', 'edited'), revision: 2, editedAt: '2026-08-26T11:00:00.000Z' },
        }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => ({
      comments: useWorkItemComments({ workItemId: ITEM_ID }),
      edit: useEditWorkItemCommentMutation({ workItemId: ITEM_ID, factoryProjectId: undefined }),
    }));
    await waitFor(() => expect(result.current.comments.isSuccess).toBe(true));

    act(() => {
      result.current.edit.mutate({ commentId: 'c1', input: { body: 'edited', expectedRevision: 1 } });
    });
    await waitForMutationsIdle(client);
    const row = result.current.comments.data?.pages[0]?.comments[0];
    expect(row?.body).toBe('edited');
    expect(row?.revision).toBe(2);
  });
});

describe('useDeleteWorkItemCommentMutation', () => {
  it('tombstones the row optimistically and keeps it after the server confirms', async () => {
    let deleted = false;
    server.use(
      http.get(COMMENTS_URL, () => {
        const row = wireComment('c1', deleted ? '' : 'original');
        return HttpResponse.json({
          comments: [deleted ? { ...row, deletedAt: '2026-08-26T11:00:00.000Z' } : row],
        });
      }),
      http.delete(`${COMMENTS_URL}/c1`, () => {
        deleted = true;
        return HttpResponse.json({
          comment: { ...wireComment('c1', ''), deletedAt: '2026-08-26T11:00:00.000Z' },
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      comments: useWorkItemComments({ workItemId: ITEM_ID }),
      remove: useDeleteWorkItemCommentMutation({ workItemId: ITEM_ID, factoryProjectId: undefined }),
    }));
    await waitFor(() => expect(result.current.comments.isSuccess).toBe(true));

    act(() => {
      result.current.remove.mutate('c1');
    });
    await waitFor(() => expect(result.current.comments.data?.pages[0]?.comments[0]?.deletedAt).not.toBeNull());

    await waitForMutationsIdle(client);
    const row = result.current.comments.data?.pages[0]?.comments[0];
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.body).toBe('');
  });
});
