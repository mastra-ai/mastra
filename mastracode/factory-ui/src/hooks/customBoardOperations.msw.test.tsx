import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { releaseBoard } from '../../e2e/ui/board-catalog';
import { server } from '../../e2e/ui/msw-server';
import { renderHookWithProviders } from '../../e2e/ui/render';
import { useBoardComposer } from '../ui/domains/factory/hooks/useBoardComposer';
import { useBoardItems } from '../ui/domains/factory/hooks/useBoardItems';
import { factoryAttentionTargetPath } from '../ui/domains/factory/services/attention';
import type { WorkItem } from '../ui/domains/factory/services/workItems';

const item: WorkItem = {
  id: 'release-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: 'fp-1',
  board: 'release',
  source: 'manual',
  sourceKey: null,
  parentWorkItemId: null,
  title: 'Rehearse release',
  url: null,
  stages: ['queued'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 4,
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z',
};
const wireItem = { ...item, factoryProjectId: 'fp-1', externalSource: null };

function listHandler() {
  return http.get('*/web/factory/projects/:id/work-items', () =>
    HttpResponse.json({
      workItems: [wireItem],
      runningSessionIds: [],
      parkedSessionIds: [],
    }),
  );
}

describe('custom board operations', () => {
  beforeEach(() => {
    server.use(http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json({ boards: [releaseBoard] })));
  });

  it.each(['shipping', 'shipped', 'execute'])('does not dispatch a drag to undeclared destination %s', async stage => {
    const transition = vi.fn(() => HttpResponse.json({}));
    server.use(listHandler(), http.post('*/web/factory/projects/:id/work-items/:itemId/transition', transition));
    const { result, client } = renderHookWithProviders(() =>
      useBoardItems({ factoryProjectId: 'fp-1', kind: 'release' }),
    );
    await waitFor(() => expect(client.isFetching()).toBe(0));
    act(() => result.current.handleDrop({ kind: 'work-item', id: item.id, fromStage: 'queued' }, stage));
    expect(transition).not.toHaveBeenCalled();
  });

  it.each(['work', 'review'])('rejects a release-card drop onto %s but allows a board-independent move', async kind => {
    const transition = vi.fn(async ({ request }: { request: Request }) => {
      const body = await request.json();
      expect(body).toMatchObject({ board: 'release', stage: 'preparing', expectedRevision: 4 });
      return HttpResponse.json({
        result: {
          status: 'accepted',
          transitionId: 'transition-1',
          itemId: item.id,
          revision: 5,
          stage: 'preparing',
          decisions: [],
        },
      });
    });
    server.use(listHandler(), http.post('*/web/factory/projects/:id/work-items/:itemId/transition', transition));
    const { result, client } = renderHookWithProviders(() => useBoardItems({ factoryProjectId: 'fp-1', kind }));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    act(() => result.current.handleDrop({ kind: 'work-item', id: item.id, fromStage: 'queued' }, 'preparing'));
    expect(transition).not.toHaveBeenCalled();
    act(() => result.current.move(item.id, 'preparing'));
    await waitFor(() => expect(transition).toHaveBeenCalledTimes(1));
  });

  it('creates on the selected board without overriding the server initial phase', async () => {
    let body: unknown;
    server.use(
      http.post('*/web/factory/projects/:id/work-items', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ workItem: wireItem });
      }),
    );
    const { result } = renderHookWithProviders(() => useBoardComposer('fp-1', releaseBoard));
    await act(() => result.current.submit('queued', item.title));
    expect(body).toEqual({ board: 'release', title: item.title });
  });

  it('files a dropped Linear candidate onto the custom board at its initial phase', async () => {
    let body: unknown;
    const transition = vi.fn(() => HttpResponse.json({}));
    server.use(
      listHandler(),
      http.post('*/web/factory/projects/:id/work-items', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ workItem: { ...wireItem, id: 'release-2', source: 'linear-issue' } });
      }),
      http.post('*/web/factory/projects/:id/work-items/:itemId/transition', transition),
    );
    const { result, client } = renderHookWithProviders(() =>
      useBoardItems({ factoryProjectId: 'fp-1', kind: 'release' }),
    );
    await waitFor(() => expect(client.isFetching()).toBe(0));
    await act(async () => {
      result.current.handleDrop(
        {
          kind: 'candidate',
          candidate: {
            source: 'linear-issue',
            sourceKey: 'linear:REL-1',
            title: 'Cut 1.2',
            url: 'https://linear.app/acme/issue/REL-1',
            metadata: {},
          },
        },
        'queued',
      );
    });
    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      board: 'release',
      stages: ['queued'],
      externalSource: { integrationId: 'linear', type: 'issue', externalId: 'linear:REL-1' },
    });
    expect(transition).not.toHaveBeenCalled();
  });

  it.each(['work', 'review', 'release'])('keeps persisted release cards isolated on %s', async kind => {
    server.use(listHandler());
    const { result } = renderHookWithProviders(() => useBoardItems({ factoryProjectId: 'fp-1', kind }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.visible.map(card => card.id)).toEqual(kind === 'release' ? [item.id] : []);
  });

  it.each(['approval_required', 'stale_revision'])(
    'sends the persisted board and revision and preserves %s rejection',
    async code => {
      let body: unknown;
      server.use(
        listHandler(),
        http.post('*/web/factory/projects/:id/work-items/:itemId/transition', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            result: { status: 'rejected', transitionId: 'transition-1', itemId: item.id, code, reason: code },
          });
        }),
      );
      const { result } = renderHookWithProviders(() => useBoardItems({ factoryProjectId: 'fp-1', kind: 'release' }));
      await waitFor(() => expect(result.current.visible).toHaveLength(1));
      act(() => result.current.move(item.id, 'preparing'));
      await waitFor(() => expect(result.current.transitionReasons[item.id]).toBe(code));
      expect(body).toMatchObject({ board: 'release', stage: 'preparing', expectedRevision: 4 });
      expect(result.current.visible[0].stages).toEqual(['queued']);
    },
  );

  it('links custom-board comments through the custom route', () => {
    expect(
      factoryAttentionTargetPath('fp-1', {
        kind: 'work-item',
        board: 'release',
        workItemId: item.id,
        commentId: 'comment-1',
      }),
    ).toBe('/factories/fp-1/boards/release?item=release-1&comment=comment-1');
  });
});
