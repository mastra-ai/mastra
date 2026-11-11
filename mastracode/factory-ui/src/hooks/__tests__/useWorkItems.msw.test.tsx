import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import type { BoardSnapshot, WorkItem } from '../../ui/domains/factory/services/workItems';
import {
  useDeleteWorkItemMutation,
  useParkedSessions,
  useSessionWorkItemsQuery,
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
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
    description: null,
    revision,
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
  };
}

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

describe('useSessionWorkItemsQuery', () => {
  const SESSION_ID = 'session-1';

  it('shows a card in the phase it is being moved to on the board', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    let stage = 'triage';
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [{ ...wireItem, stages: [stage] }] }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${ITEM_ID}/transition`, async () => {
        await responseGate;
        stage = 'planning';
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

    const { result, client } = renderHookWithProviders(() => ({
      cards: useSessionWorkItemsQuery(PROJECT_ID, SESSION_ID),
      move: useTransitionWorkItemMutation(PROJECT_ID, 'user-1'),
    }));
    await waitFor(() => expect(result.current.cards.data?.[0]?.stages).toEqual(['triage']));

    act(() => {
      result.current.move.mutate({ item: item(1, 'triage'), board: 'work', stage: 'planning' });
    });
    await waitFor(() => expect(result.current.cards.data?.[0]?.stages).toEqual(['planning']));
    expect(result.current.move.isPending).toBe(true);

    releaseResponse();
    await waitForMutationsIdle(client);
  });

  it('gets a card back when deleting it fails', async () => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>(resolve => {
      releaseResponse = resolve;
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [wireItem] }),
      ),
      http.delete(`${TEST_BASE_URL}/web/factory/work-items/${ITEM_ID}`, async () => {
        await responseGate;
        return HttpResponse.json({ error: 'conflict' }, { status: 409 });
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      cards: useSessionWorkItemsQuery(PROJECT_ID, SESSION_ID),
      remove: useDeleteWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.cards.data).toHaveLength(1));

    act(() => {
      result.current.remove.mutate(ITEM_ID);
    });
    await waitFor(() => expect(result.current.cards.data).toEqual([]));

    releaseResponse();
    await waitForMutationsIdle(client);
    await waitFor(() => expect(result.current.cards.data?.map(card => card.id)).toEqual([ITEM_ID]));
  });

  it('leaves out a card created on the board', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [wireItem] }),
      ),
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ workItem: { ...wireItem, id: 'item-2', title: 'New card' } }),
      ),
    );

    const { result } = renderHookWithProviders(() => ({
      board: useWorkItemsQuery(PROJECT_ID),
      session: useSessionWorkItemsQuery(PROJECT_ID, SESSION_ID),
      create: useUpsertWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.board.data).toHaveLength(1));
    await waitFor(() => expect(result.current.session.data).toHaveLength(1));

    act(() => {
      result.current.create.mutate({ source: 'github-issue', sourceKey: 'github-issue:2', title: 'New card' });
    });
    await waitFor(() => expect(result.current.board.data?.map(card => card.id)).toEqual(['item-2', ITEM_ID]));
    expect(result.current.session.data?.map(card => card.id)).toEqual([ITEM_ID]);
  });
});

describe('useWorkItemsQuery', () => {
  const card = (id: string, title = id) => ({ ...wireItem, id, title, createdAt: `2026-07-0${id}T00:00:00.000Z` });
  const titles = (cards: WorkItem[] | undefined) => cards?.map(item => item.title);
  /** Answers the board reads in turn, and records the `since` each one sent. */
  function serveBoard(...answers: unknown[]) {
    const sinces: Array<string | null> = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, async ({ request }) => {
        sinces.push(new URL(request.url).searchParams.get('since'));
        return HttpResponse.json((await answers[sinces.length - 1]) as object);
      }),
    );
    return sinces;
  }
  /** What a feed frame does to the board. */
  const refresh = (client: QueryClient) => client.invalidateQueries({ queryKey: queryKeys.workItems(PROJECT_ID) });

  it('reads the board whole, then merges what moved since its cursor into the cards it holds', async () => {
    const sinces = serveBoard(
      { workItems: [card('5'), card('4'), card('2'), card('1')], cursor: 'first' },
      { workItems: [card('4', 'Renamed'), card('3'), card('6')], removedIds: ['5'], total: 5, cursor: 'second' },
    );
    const { result, client } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['5', '4', '2', '1']));
    const unchanged = result.current.data!.slice(2);

    await act(() => refresh(client));

    await waitFor(() => expect(titles(result.current.data)).toEqual(['6', 'Renamed', '3', '2', '1']));
    expect(sinces).toEqual([null, 'first']);
    // Each sits where another card did: sharing by position would have rebuilt them.
    expect(result.current.data![3]).toBe(unchanged[0]);
    expect(result.current.data![4]).toBe(unchanged[1]);
  });

  it('takes a whole board whenever the server sends one, as one that ignores `since` does', async () => {
    const sinces = serveBoard(
      { workItems: [card('1')], cursor: 'first' },
      { workItems: [card('2'), card('1')] },
      { workItems: [card('2'), card('1')] },
    );
    const { result, client } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['1']));

    await act(() => refresh(client));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['2', '1']));
    const cards = result.current.data;
    await act(() => refresh(client));
    await waitForMutationsIdle(client);

    expect(sinces).toEqual([null, 'first', null]);
    expect(result.current.data).toBe(cards);
  });

  it('reads the board whole once when its count differs from the server’s', async () => {
    const sinces = serveBoard(
      { workItems: [card('1')], cursor: 'first' },
      { workItems: [], removedIds: [], total: 2, cursor: 'second' },
      { workItems: [card('2'), card('1')], cursor: 'third' },
    );
    const { result, client } = renderHookWithProviders(() => useWorkItemsQuery(PROJECT_ID));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['1']));

    await act(() => refresh(client));

    await waitFor(() => expect(titles(result.current.data)).toEqual(['2', '1']));
    expect(sinces).toEqual([null, 'first', null]);
  });

  it('keeps a change the server has not answered through a merge, and drops it once the server refuses', async () => {
    let refuse!: () => void;
    let answerLate!: (answer: object) => void;
    const refusal = new Promise<void>(resolve => (refuse = resolve));
    const lateAnswer = new Promise<object>(resolve => (answerLate = resolve));
    const nothingMoved = { workItems: [], removedIds: [], total: 2 };
    const sinces = serveBoard(
      { workItems: [card('2'), card('1')], cursor: 'first' },
      { ...nothingMoved, cursor: 'second' },
      lateAnswer,
      { workItems: [card('2'), card('1')], cursor: 'fourth' },
    );
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/1`, async () => {
        await refusal;
        return HttpResponse.json({ error: 'refused' }, { status: 409 });
      }),
    );
    const { result, client } = renderHookWithProviders(() => ({
      cards: useWorkItemsQuery(PROJECT_ID),
      update: useUpdateWorkItemMutation(PROJECT_ID),
    }));
    const parent = () => result.current.cards.data?.[1]?.parentWorkItemId;
    await waitFor(() => expect(result.current.cards.data).toHaveLength(2));

    act(() => result.current.update.mutate({ id: '1', patch: { parentWorkItemId: '2' } }));
    await waitFor(() => expect(parent()).toBe('2'));
    await act(() => refresh(client));
    expect(sinces).toEqual([null, 'first']);
    expect(parent()).toBe('2');

    // The refusal lands while a read is out: its answer must not bring the change back.
    act(() => void refresh(client));
    await waitFor(() => expect(sinces).toHaveLength(3));
    refuse();
    await waitFor(() => expect(result.current.update.isError).toBe(true));
    answerLate({ ...nothingMoved, cursor: 'third' });
    await waitForMutationsIdle(client);

    expect(parent()).toBeNull();
    expect(sinces).toEqual([null, 'first', 'second', null]);
  });

  it('does not take a card being deleted here for a drifted count', async () => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => (finish = resolve));
    const sinces = serveBoard(
      { workItems: [card('2'), card('1')], cursor: 'first' },
      { workItems: [], removedIds: [], total: 2, cursor: 'second' },
      { workItems: [], removedIds: ['1'], total: 1, cursor: 'third' },
    );
    server.use(
      http.delete(`${TEST_BASE_URL}/web/factory/work-items/1`, async () => {
        await finished;
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, client } = renderHookWithProviders(() => ({
      cards: useWorkItemsQuery(PROJECT_ID),
      remove: useDeleteWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.cards.data).toHaveLength(2));

    act(() => result.current.remove.mutate('1'));
    await waitFor(() => expect(titles(result.current.cards.data)).toEqual(['2']));
    await act(() => refresh(client));
    finish();
    await waitForMutationsIdle(client);

    expect(titles(result.current.cards.data)).toEqual(['2']);
    expect(sinces).toEqual([null, 'first', 'second']);
  });
});
