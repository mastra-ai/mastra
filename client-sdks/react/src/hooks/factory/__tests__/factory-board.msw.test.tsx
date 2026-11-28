// @vitest-environment jsdom
import type { BoardPhasesRequest } from '@mastra/client-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { MastraReactProvider } from '../../../mastra-react-provider';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { FactoryBasePathProvider } from '../context';
import { factoryKeys } from '../keys';
import { moveAnswered } from '../submitted-moves';
import { useCardSessions, useRecentAuditEvents } from '../use-board-activity';
import { useRunQueue } from '../use-factory-decisions';
import { useBoardPhasesQuery, useTransitionWorkItemMutation } from '../use-work-items';

const FP = 'fp-1';
const API = `${TEST_BASE_URL}/web/factory/projects/${FP}`;

const wireCard = (stage: string, revision = 1) => ({
  id: 'w1',
  orgId: 'org',
  createdBy: 'u1',
  factoryProjectId: FP,
  externalSource: null,
  parentWorkItemId: null,
  title: 'Fix it',
  stages: [stage],
  stageHistory: [],
  sessions: {},
  metadata: null,
  revision,
  createdAt: '2026-11-27T00:00:00.000Z',
  updatedAt: '2026-11-27T00:00:00.000Z',
});

const request: BoardPhasesRequest = { board: 'work', sort: 'recent', q: '', filters: {}, windows: {} };

function phasesAnswer(stage: string, version: string, withBodies: boolean) {
  return {
    phases: [
      {
        phase: 'backlog',
        total: stage === 'backlog' ? 1 : 0,
        cards: stage === 'backlog' ? [{ id: 'w1', version }] : [],
      },
      { phase: 'build', total: stage === 'build' ? 1 : 0, cards: stage === 'build' ? [{ id: 'w1', version }] : [] },
    ],
    related: [],
    boardTotal: 1,
    matchingTotal: 1,
    ...(withBodies ? { workItems: [{ ...wireCard(stage), version }] } : {}),
  };
}

function setup(basePath?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => {
    const inner = <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    return (
      <MastraReactProvider baseUrl={TEST_BASE_URL}>
        {basePath ? <FactoryBasePathProvider basePath={basePath}>{inner}</FactoryBasePathProvider> : inner}
      </MastraReactProvider>
    );
  };
  return { queryClient, wrapper };
}

describe('Factory board hooks', () => {
  describe('when the board is read again', () => {
    it('downloads card bodies on the first read, then only cards whose version changed', async () => {
      const reads: string[] = [];
      let version = 'v1';
      server.use(
        http.get(`${API}/boards/work/phases`, ({ request: req }) => {
          const url = new URL(req.url);
          reads.push(url.searchParams.get('cards') ?? 'none');
          return HttpResponse.json(phasesAnswer('backlog', version, url.searchParams.has('cards')));
        }),
        http.get(`${API}/work-items`, () => HttpResponse.json({ workItems: [{ ...wireCard('backlog', 2), version }] })),
      );
      const { wrapper, queryClient } = setup();
      const { result } = renderHook(() => useBoardPhasesQuery(FP, request), { wrapper });

      await waitFor(() => expect(result.current.data?.workItems).toHaveLength(1));
      const first = result.current.data!;
      expect(first.phases[0]).toEqual({ phase: 'backlog', total: 1, ids: ['w1'] });

      // Unchanged versions: the same snapshot comes back, so nothing showing it renders again.
      await act(() => queryClient.invalidateQueries({ queryKey: factoryKeys.workItems(FP) }));
      expect(result.current.data).toBe(first);

      version = 'v2';
      await act(() => queryClient.invalidateQueries({ queryKey: factoryKeys.workItems(FP) }));
      await waitFor(() => expect(result.current.data?.workItems[0]?.revision).toBe(2));
      expect(reads).toEqual(['true', 'none', 'none']);
    });
  });

  describe('when a move is accepted later on the feed', () => {
    it('moves the card at once and keeps it there', async () => {
      let stage = 'backlog';
      server.use(
        http.get(`${API}/boards/work/phases`, ({ request: req }) =>
          HttpResponse.json(phasesAnswer(stage, `v-${stage}`, new URL(req.url).searchParams.has('cards'))),
        ),
        http.get(`${API}/work-items`, () =>
          HttpResponse.json({ workItems: [{ ...wireCard(stage, 2), version: `v-${stage}` }] }),
        ),
        http.post(`${API}/work-items/w1/transition`, () =>
          HttpResponse.json({ status: 'submitted', inputId: 'in-1' }, { status: 202 }),
        ),
        http.get(`${API}/decisions`, () => HttpResponse.json({ decisions: [] })),
      );
      const { wrapper } = setup();
      const { result } = renderHook(
        () => ({ board: useBoardPhasesQuery(FP, request), move: useTransitionWorkItemMutation(FP, 'u1') }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.board.data?.workItems).toHaveLength(1));
      const card = result.current.board.data!.workItems[0]!;

      let outcome: Promise<unknown>;
      act(() => {
        outcome = result.current.move.mutateAsync({ item: card, board: 'work', stage: 'build' });
      });
      await waitFor(() => expect(result.current.board.data?.workItems[0]?.stages).toEqual(['build']));
      await waitFor(() => expect(result.current.move.pendingTransitions).toEqual([{ itemId: 'w1', stage: 'build' }]));

      stage = 'build';
      moveAnswered({ inputId: 'in-1', status: 'accepted' });
      await expect(outcome!).resolves.toEqual({ status: 'landed', inputId: 'in-1' });
      await waitFor(() => expect(result.current.board.data?.phases[1]?.ids).toEqual(['w1']));
    });
  });

  describe('when a move is refused', () => {
    it('puts the card back in the phase it left', async () => {
      server.use(
        http.get(`${API}/boards/work/phases`, ({ request: req }) =>
          HttpResponse.json(phasesAnswer('backlog', 'v1', new URL(req.url).searchParams.has('cards'))),
        ),
        http.post(`${API}/work-items/w1/transition`, () =>
          HttpResponse.json(
            {
              result: { status: 'rejected', transitionId: 't1', itemId: 'w1', code: 'busy', reason: 'Card is running' },
            },
            { status: 409 },
          ),
        ),
        http.get(`${API}/work-items`, () =>
          HttpResponse.json({ workItems: [{ ...wireCard('backlog'), version: 'v1' }] }),
        ),
        http.get(`${API}/decisions`, () => HttpResponse.json({ decisions: [] })),
      );
      const { wrapper } = setup();
      const { result } = renderHook(
        () => ({ board: useBoardPhasesQuery(FP, request), move: useTransitionWorkItemMutation(FP) }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.board.data?.workItems).toHaveLength(1));
      const card = result.current.board.data!.workItems[0]!;

      await act(async () => {
        await expect(
          result.current.move.mutateAsync({ item: card, board: 'work', stage: 'build' }),
        ).resolves.toMatchObject({ status: 'rejected', reason: 'Card is running' });
      });
      expect(result.current.board.data?.workItems[0]?.stages).toEqual(['backlog']);
    });
  });

  describe('when the host provides a base path', () => {
    it('reads under that path', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/v1/factory/projects/${FP}/run-queue`, () =>
          HttpResponse.json({ pending: [], running: [] }),
        ),
      );
      const { wrapper } = setup('/v1/factory');
      const { result } = renderHook(() => useRunQueue(FP), { wrapper });
      await waitFor(() => expect(result.current.data).toEqual({ pending: [], running: [] }));
    });
  });
});

describe('when the board reads who is working on its cards', () => {
  it('marks the cards whose sessions run or wait, and holds them', async () => {
    server.use(
      http.get(`${API}/session-activity`, () =>
        HttpResponse.json({
          runningSessionIds: ['s1'],
          parkedSessionIds: ['s2'],
          cardStatuses: { w1: 'working', w2: 'waiting', w3: 'done' },
          sessionHeldCardIds: ['w1', 'w2'],
          cards: { working: 1, waiting: 1 },
        }),
      ),
    );
    const { result } = renderHook(() => useCardSessions('fp-1'), { wrapper: setup().wrapper });
    await waitFor(() => expect(result.current.current).toBe(true));
    expect([...result.current.statuses]).toEqual([
      ['w1', 'working'],
      ['w2', 'ready'],
    ]);
    expect([...result.current.held]).toEqual(['w1', 'w2']);
  });

  it('reads recent audit events page by page, up to three pages', async () => {
    const asked: string[] = [];
    server.use(
      http.get(`${API}/audit`, ({ request }) => {
        const before = new URL(request.url).searchParams.get('before');
        asked.push(before ?? '');
        return HttpResponse.json({
          events: [{ id: `e-${asked.length}` }],
          actors: { u1: { id: 'u1' } },
          nextCursor: `c${asked.length}`,
        });
      }),
    );
    const { result } = renderHook(() => useRecentAuditEvents('fp-1', 'board', 200, ['u1']), {
      wrapper: setup().wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(asked).toEqual(['', 'c1', 'c2']);
    expect(result.current.data?.events).toHaveLength(3);
  });
});
