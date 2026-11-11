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
