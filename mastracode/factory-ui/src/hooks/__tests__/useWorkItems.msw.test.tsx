import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import type { BoardSnapshot, WorkItem } from '../../ui/domains/factory/services/workItems';
import {
  useDeleteWorkItemMutation,
  useParkedSessions,
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useWorkItemsQuery,
} from '../useWorkItems';

const board = (workItems: WorkItem[]): BoardSnapshot => ({ workItems, runningSessionIds: [], parkedSessionIds: [] });

const PROJECT_ID = 'project-1';
const ITEM_ID = 'item-1';

function item(revision: number, stage: string): WorkItem {
  return {
    id: ITEM_ID,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: PROJECT_ID,
    source: 'github-issue',
    sourceKey: 'github-issue:1',
    parentWorkItemId: null,
    title: 'Late response test',
    url: null,
    stages: [stage],
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  };
}

describe('useTransitionWorkItemMutation', () => {
  it('optimistically records the Factory stage entry used to order the destination column', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${ITEM_ID}/transition`, async () => {
        await responseGate;
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: ITEM_ID,
            revision: 2,
            stage: 'planning',
            decisions: [],
          },
        });
      }),
    );

    const original = {
      ...item(1, 'triage'),
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-18T00:00:00.000Z', by: 'user-2' }],
    };
    const { result, client } = renderHookWithProviders(() => useTransitionWorkItemMutation(PROJECT_ID, 'user-1'));
    client.setQueryData(queryKeys.workItems(PROJECT_ID), board([original]));

    act(() => {
      result.current.mutate({ item: original, board: 'work', stage: 'planning' });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    const optimistic = client.getQueryData<BoardSnapshot>(queryKeys.workItems(PROJECT_ID))?.workItems[0];
    expect(optimistic?.stages).toEqual(['planning']);
    expect(optimistic?.stageHistory[0]).toMatchObject({ stage: 'triage', exitedBy: 'user-1' });
    expect(optimistic?.stageHistory[1]).toMatchObject({ stage: 'planning', by: 'user-1' });

    releaseResponse();
    await waitForMutationsIdle(client);
  });

  it('does not let an older accepted response overwrite a newer canonical revision', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${ITEM_ID}/transition`, async () => {
        await responseGate;
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-old',
            itemId: ITEM_ID,
            revision: 2,
            stage: 'triage',
            decisions: [],
          },
        });
      }),
    );

    const original = item(1, 'intake');
    const canonical = item(3, 'planning');
    const { result, client } = renderHookWithProviders(() => useTransitionWorkItemMutation(PROJECT_ID));
    client.setQueryData(queryKeys.workItems(PROJECT_ID), board([original]));

    act(() => {
      result.current.mutate({ item: original, board: 'work', stage: 'triage' });
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    client.setQueryData(queryKeys.workItems(PROJECT_ID), board([canonical]));
    releaseResponse();
    await waitForMutationsIdle(client);

    expect(client.getQueryData<BoardSnapshot>(queryKeys.workItems(PROJECT_ID))).toEqual(board([canonical]));
  });

  it('exposes the destination stage of in-flight transitions and clears it on settle', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${ITEM_ID}/transition`, async () => {
        await responseGate;
        return HttpResponse.json({
          result: {
            status: 'accepted',
            transitionId: 'transition-1',
            itemId: ITEM_ID,
            revision: 2,
            stage: 'planning',
            decisions: [],
          },
        });
      }),
    );

    const original = item(1, 'triage');
    const { result, client } = renderHookWithProviders(() => useTransitionWorkItemMutation(PROJECT_ID));
    client.setQueryData(queryKeys.workItems(PROJECT_ID), board([original]));

    act(() => {
      result.current.mutate({ item: original, board: 'work', stage: 'planning' });
    });
    await waitFor(() => expect(result.current.pendingTransitions).toEqual([{ itemId: ITEM_ID, stage: 'planning' }]));

    releaseResponse();
    await waitForMutationsIdle(client);
    expect(result.current.pendingTransitions).toEqual([]);
  });
});

describe('useDeleteWorkItemMutation', () => {
  it('drops the deleted card and its session marker from the board read', async () => {
    // Wire shape of item(): the server sends factoryProjectId/externalSource,
    // which listWorkItems maps back to the client fields.
    const wireItem = {
      id: ITEM_ID,
      orgId: 'org-1',
      createdBy: 'user-1',
      factoryProjectId: PROJECT_ID,
      externalSource: null,
      parentWorkItemId: null,
      title: 'Running card',
      stages: ['execute'],
      stageHistory: [],
      sessions: {},
      metadata: {},
      revision: 1,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    };
    let deleted = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json(
          deleted
            ? { workItems: [], parkedSessionIds: [] }
            : { workItems: [wireItem], parkedSessionIds: ['session-1'] },
        ),
      ),
      http.delete(`${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}`, () => {
        deleted = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      parked: useParkedSessions(PROJECT_ID),
      remove: useDeleteWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.parked.has('session-1')).toBe(true));

    act(() => {
      result.current.remove.mutate(ITEM_ID);
    });
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.parked.has('session-1')).toBe(false));
  });
});

describe('board polling revalidation', () => {
  const LIST_URL = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`;
  const wireItem = (title: string) => ({
    id: ITEM_ID,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: PROJECT_ID,
    externalSource: null,
    parentWorkItemId: null,
    title,
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  });

  /** A server that keeps one board and answers 304 to a matching validator, as the Factory does. */
  function boardServer(initial: { etag: string; body: Record<string, unknown> }) {
    const state = { ...initial };
    const seen: Array<{ ifNoneMatch: string | null; status: number }> = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        const ifNoneMatch = request.headers.get('if-none-match');
        const headers = { ETag: state.etag, 'Cache-Control': 'private, no-cache' };
        if (ifNoneMatch === state.etag) {
          seen.push({ ifNoneMatch, status: 304 });
          return new HttpResponse(null, { status: 304, headers });
        }
        seen.push({ ifNoneMatch, status: 200 });
        return HttpResponse.json(state.body, { headers });
      }),
    );
    return { state, seen };
  }

  async function refetch(client: QueryClient) {
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.workItems(PROJECT_ID) });
    });
  }

  it('revalidates with the last ETag and keeps the board as is on 304', async () => {
    const { seen } = boardServer({
      etag: 'W/"v1"',
      body: { workItems: [wireItem('First read')], runningSessionIds: ['session-1'], parkedSessionIds: [] },
    });
    const { result, client } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('First read'));
    const firstCards = result.current.data;

    await refetch(client);
    expect(seen).toEqual([
      { ifNoneMatch: null, status: 200 },
      { ifNoneMatch: 'W/"v1"', status: 304 },
    ]);
    // Same object back: nothing re-rendered off a board that did not change.
    expect(result.current.data).toBe(firstCards);
    expect(client.getQueryData<BoardSnapshot>(queryKeys.workItems(PROJECT_ID))?.runningSessionIds).toEqual([
      'session-1',
    ]);
    expect(result.current.isError).toBe(false);
  });

  it('reads the new board in full once the server changes it', async () => {
    const { state, seen } = boardServer({ etag: 'W/"v1"', body: { workItems: [wireItem('First read')] } });
    const { result, client } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('First read'));

    state.etag = 'W/"v2"';
    state.body = { workItems: [wireItem('Edited elsewhere')] };
    await refetch(client);
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('Edited elsewhere'));

    await refetch(client);
    expect(seen.map(s => s.status)).toEqual([200, 200, 304]);
    expect(seen[2]?.ifNoneMatch).toBe('W/"v2"');
  });

  it('reads in full after patching the cached board, so a local edit never pins a stale validator', async () => {
    const { seen } = boardServer({ etag: 'W/"v1"', body: { workItems: [wireItem('First read')] } });
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}`, () =>
        HttpResponse.json({ workItem: wireItem('Renamed here') }),
      ),
    );
    const { result, client } = renderHookWithProviders(() => ({
      cards: useWorkItemsQuery(PROJECT_ID),
      update: useUpdateWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.cards.data).toHaveLength(1));
    expect(client.getQueryData<BoardSnapshot>(queryKeys.workItems(PROJECT_ID))?.validator?.etag).toBe('W/"v1"');

    act(() => {
      result.current.update.mutate({ id: ITEM_ID, patch: { title: 'Renamed here' } });
    });
    await waitForMutationsIdle(client);
    expect(result.current.cards.data?.[0]?.title).toBe('Renamed here');
    expect(client.getQueryData<BoardSnapshot>(queryKeys.workItems(PROJECT_ID))?.validator).toBeUndefined();

    await refetch(client);
    expect(seen.at(-1)).toEqual({ ifNoneMatch: null, status: 200 });
  });

  it('polls a board the server cannot validate without ever sending a validator', async () => {
    const seen: Array<string | null> = [];
    server.use(
      http.get(LIST_URL, ({ request }) => {
        seen.push(request.headers.get('if-none-match'));
        return HttpResponse.json({ workItems: [wireItem('Unversioned')] });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('Unversioned'));
    await refetch(client);
    expect(seen).toEqual([null, null]);
  });

  it('recovers from an unasked-for 304 by reading once more unconditionally', async () => {
    let calls = 0;
    server.use(
      http.get(LIST_URL, () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 304 })
          : HttpResponse.json({ workItems: [wireItem('Recovered')] }, { headers: { ETag: 'W/"v1"' } });
      }),
    );
    const { result } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('Recovered'));
    expect(calls).toBe(2);
  });
});
