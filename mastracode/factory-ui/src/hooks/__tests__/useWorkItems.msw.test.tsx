import type { QueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { answerWorkItemColumns } from '../../../e2e/ui/board-reads';
import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import type { WorkItemColumnsRequest } from '../../api/types';
import type { BoardSnapshot, WorkItem } from '../../ui/domains/factory/services/workItems';
import {
  useBoardColumnsQuery,
  useDeleteWorkItemMutation,
  useSessionWorkItemsQuery,
  useSidebarWorkItemsQuery,
  useTransitionWorkItemMutation,
  useUpdateWorkItemMutation,
  useUpsertWorkItemMutation,
} from '../useWorkItems';
import type { BoardColumnsSnapshot } from '../useWorkItems';

const board = (workItems: WorkItem[]): BoardSnapshot => ({ workItems, runningSessionIds: [], parkedSessionIds: [] });

/** The board the paged reads list: the two phases these cards sit in. */
const BOARD = { id: 'work', phases: [{ id: 'intake' }, { id: 'execute' }] };

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
  it('drops the deleted card and its session marker from the cards the sidebar reads', async () => {
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
      cards: useSidebarWorkItemsQuery(PROJECT_ID),
      remove: useDeleteWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.cards.data?.parkedSessionIds).toEqual(['session-1']));

    act(() => {
      result.current.remove.mutate(ITEM_ID);
    });
    await waitFor(() => expect(result.current.cards.data?.workItems).toEqual([]));
    await waitForMutationsIdle(client);

    await waitFor(() => expect(result.current.cards.data?.parkedSessionIds).toEqual([]));
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

    const { result, client } = renderHookWithProviders(() => ({
      session: useSessionWorkItemsQuery(PROJECT_ID, SESSION_ID),
      create: useUpsertWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(result.current.session.data).toHaveLength(1));

    act(() => {
      result.current.create.mutate({ source: 'github-issue', sourceKey: 'github-issue:2', title: 'New card' });
    });
    await waitForMutationsIdle(client);
    expect(result.current.create.isSuccess).toBe(true);
    expect(result.current.session.data?.map(card => card.id)).toEqual([ITEM_ID]);
  });
});

describe('useBoardColumnsQuery', () => {
  const cardId = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  /** A card on the wire; a write stamps it, here with a day per version. */
  const card = (number: number, title = `Card ${number}`, version = 1) => ({
    ...wireItem,
    id: cardId(number),
    title,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, number)).toISOString(),
    changedAt: `2026-08-${String(10 + version)}T00:00:00.000Z`,
  });
  const VIEW: WorkItemColumnsRequest = { board: 'work', sort: 'recent', q: '', filters: {}, windows: {} };

  /** Serves the project's paged reads from `project.cards`, and records what the tab asked for. */
  function serveProject(cards: Array<typeof wireItem & { changedAt: string }>) {
    const project = { cards, listings: new Array<URLSearchParams>(), cardReads: new Array<string[]>() };
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/columns`, ({ request }) => {
        project.listings.push(new URL(request.url).searchParams);
        return answerWorkItemColumns(request, { workItems: project.cards, boards: [BOARD], userId: 'user-1' });
      }),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, ({ request }) => {
        const ids = new URL(request.url).searchParams.getAll('workItemId');
        project.cardReads.push(ids);
        return HttpResponse.json({ workItems: project.cards.filter(listed => ids.includes(listed.id)) });
      }),
    );
    return project;
  }
  /** What a feed frame does to the board. */
  const refresh = (client: QueryClient) => client.invalidateQueries({ queryKey: queryKeys.workItems(PROJECT_ID) });
  const column = (snapshot: BoardColumnsSnapshot | undefined, stage: string) =>
    snapshot?.columns.find(listed => listed.stage === stage);
  const titles = (snapshot: BoardColumnsSnapshot | undefined) =>
    column(snapshot, 'execute')?.ids.map(id => snapshot?.workItems.find(held => held.id === id)?.title);

  it('reads a board it holds no card of in one request, then downloads nothing while nothing changes', async () => {
    const project = serveProject([card(1), card(2)]);
    const { result, client } = renderHookWithProviders(() => useBoardColumnsQuery(PROJECT_ID, VIEW));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['Card 2', 'Card 1']));
    const snapshot = result.current.data;

    await act(() => refresh(client));

    expect(project.listings.map(asked => asked.get('cards'))).toEqual(['true', null]);
    expect(project.cardReads).toEqual([]);
    // Nothing changed: whatever renders the board has nothing to render again.
    expect(result.current.data).toBe(snapshot);
  });

  it('downloads only the cards that changed or appeared, and keeps every other card the object it held', async () => {
    const project = serveProject([card(1), card(2), card(3)]);
    const { result, client } = renderHookWithProviders(() => useBoardColumnsQuery(PROJECT_ID, VIEW));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['Card 3', 'Card 2', 'Card 1']));
    const held = (number: number) => result.current.data?.workItems.find(item => item.id === cardId(number));
    const [first, third] = [held(1), held(3)];

    project.cards = [card(1), card(2, 'Renamed', 2), card(3), card(4)];
    await act(() => refresh(client));

    await waitFor(() => expect(titles(result.current.data)).toEqual(['Card 4', 'Card 3', 'Renamed', 'Card 1']));
    expect(project.cardReads.map(ids => ids.toSorted())).toEqual([[cardId(2), cardId(4)]]);
    expect(held(1)).toBe(first);
    expect(held(3)).toBe(third);
    expect(column(result.current.data, 'execute')?.total).toBe(4);
  });

  it('stops listing a card the server no longer holds, without asking for any card', async () => {
    const project = serveProject([card(1), card(2)]);
    const { result, client } = renderHookWithProviders(() => useBoardColumnsQuery(PROJECT_ID, VIEW));
    await waitFor(() => expect(titles(result.current.data)).toEqual(['Card 2', 'Card 1']));

    project.cards = [card(1)];
    await act(() => refresh(client));

    await waitFor(() => expect(titles(result.current.data)).toEqual(['Card 1']));
    expect(project.cardReads).toEqual([]);
    expect(result.current.data?.boardTotal).toBe(1);
  });

  it('lists a column deeper by downloading only the cards past the ones it holds', async () => {
    const project = serveProject(Array.from({ length: 60 }, (_, index) => card(index + 1)));
    const { result, rerender } = renderHookWithProviders(
      (windows: WorkItemColumnsRequest['windows']) => useBoardColumnsQuery(PROJECT_ID, { ...VIEW, windows }),
      { initialProps: VIEW.windows },
    );
    await waitFor(() => expect(column(result.current.data, 'execute')).toMatchObject({ total: 60 }));
    expect(column(result.current.data, 'execute')?.ids).toHaveLength(50);

    rerender({ execute: 100 });
    // The column keeps its cards while the deeper listing loads.
    expect(column(result.current.data, 'execute')?.ids).toHaveLength(50);

    await waitFor(() => expect(column(result.current.data, 'execute')?.ids).toHaveLength(60));
    expect(project.listings.at(-1)?.getAll('window')).toEqual(['execute:100']);
    expect(project.listings.at(-1)?.has('cards')).toBe(false);
    expect(project.cardReads).toHaveLength(1);
    expect(project.cardReads[0]?.toSorted()).toEqual(Array.from({ length: 10 }, (_, index) => cardId(index + 1)));
  });

  it('asks the server for another view of a board it holds, and downloads no card it already has', async () => {
    const project = serveProject([card(1, 'Fix login'), card(2, 'Ship billing')]);
    const { result, rerender } = renderHookWithProviders(
      (q: string) => useBoardColumnsQuery(PROJECT_ID, { ...VIEW, q }),
      { initialProps: '' },
    );
    await waitFor(() => expect(titles(result.current.data)).toEqual(['Ship billing', 'Fix login']));

    rerender('login');

    await waitFor(() => expect(titles(result.current.data)).toEqual(['Fix login']));
    expect(project.listings.at(-1)?.get('q')).toBe('login');
    expect(project.cardReads).toEqual([]);
    expect(result.current.data).toMatchObject({ matchingTotal: 1, boardTotal: 2 });
  });

  it('keeps the open card listed when newer cards push it past the ones its column lists, and reads nothing to open it', async () => {
    const project = serveProject(Array.from({ length: 50 }, (_, index) => card(index + 1)));
    const { result, rerender, client } = renderHookWithProviders(
      (openCard: string | undefined) => useBoardColumnsQuery(PROJECT_ID, VIEW, openCard),
      { initialProps: undefined },
    );
    await waitFor(() => expect(column(result.current.data, 'execute')?.ids.at(-1)).toBe(cardId(1)));

    rerender(cardId(1));
    expect(project.listings).toHaveLength(1);

    project.cards = [...project.cards, card(51), card(52)];
    await act(() => refresh(client));

    await waitFor(() => expect(column(result.current.data, 'execute')?.total).toBe(52));
    expect(project.listings.at(-1)?.get('item')).toBe(cardId(1));
    expect(column(result.current.data, 'execute')?.ids.at(-1)).toBe(cardId(1));

    // Closed, the card is listed like any other: the column goes back to its first cards.
    rerender(undefined);
    await act(() => refresh(client));

    await waitFor(() => expect(column(result.current.data, 'execute')?.ids).toHaveLength(50));
    expect(project.listings.at(-1)?.has('item')).toBe(false);
    expect(column(result.current.data, 'execute')?.ids).not.toContain(cardId(1));
  });

  it('keeps a change the server has not answered through a refresh, and drops it once the server refuses', async () => {
    let refuse = () => {};
    const refusal = new Promise<void>(resolve => {
      refuse = resolve;
    });
    serveProject([card(1), card(2)]);
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/work-items/${cardId(1)}`, async () => {
        await refusal;
        return HttpResponse.json({ error: 'refused' }, { status: 409 });
      }),
    );
    const { result, client } = renderHookWithProviders(() => ({
      board: useBoardColumnsQuery(PROJECT_ID, VIEW),
      update: useUpdateWorkItemMutation(PROJECT_ID),
    }));
    const parent = () => result.current.board.data?.workItems.find(item => item.id === cardId(1))?.parentWorkItemId;
    await waitFor(() => expect(result.current.board.data?.workItems).toHaveLength(2));

    act(() => result.current.update.mutate({ id: cardId(1), patch: { parentWorkItemId: cardId(2) } }));
    await waitFor(() => expect(parent()).toBe(cardId(2)));
    await act(() => refresh(client));
    expect(parent()).toBe(cardId(2));

    refuse();
    await waitForMutationsIdle(client);
    expect(parent()).toBeNull();
  });

  it('takes a deleted card out of its column and its counts before the server answers', async () => {
    let finish = () => {};
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const project = serveProject([card(1), card(2)]);
    server.use(
      http.delete(`${TEST_BASE_URL}/web/factory/work-items/${cardId(1)}`, async () => {
        await finished;
        project.cards = [card(2)];
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, client } = renderHookWithProviders(() => ({
      board: useBoardColumnsQuery(PROJECT_ID, VIEW),
      remove: useDeleteWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(titles(result.current.board.data)).toEqual(['Card 2', 'Card 1']));

    act(() => result.current.remove.mutate(cardId(1)));

    await waitFor(() => expect(titles(result.current.board.data)).toEqual(['Card 2']));
    expect(result.current.board.data).toMatchObject({ matchingTotal: 1, boardTotal: 1 });
    expect(column(result.current.board.data, 'execute')?.total).toBe(1);
    finish();
    await waitForMutationsIdle(client);
    expect(titles(result.current.board.data)).toEqual(['Card 2']);
  });

  it('shows a card created here on top of its column and counts it, without reading the board again', async () => {
    const project = serveProject([card(1)]);
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
        HttpResponse.json({ workItem: { ...card(2, 'New card'), stages: ['intake'] } }),
      ),
    );
    const { result, client } = renderHookWithProviders(() => ({
      board: useBoardColumnsQuery(PROJECT_ID, VIEW),
      create: useUpsertWorkItemMutation(PROJECT_ID),
    }));
    await waitFor(() => expect(titles(result.current.board.data)).toEqual(['Card 1']));

    act(() => result.current.create.mutate({ source: 'manual', sourceKey: null, title: 'New card' }));
    await waitForMutationsIdle(client);

    expect(column(result.current.board.data, 'intake')).toEqual({ stage: 'intake', total: 1, ids: [cardId(2)] });
    expect(result.current.board.data).toMatchObject({ matchingTotal: 2, boardTotal: 2 });
    expect(project.listings).toHaveLength(1);
  });
});
