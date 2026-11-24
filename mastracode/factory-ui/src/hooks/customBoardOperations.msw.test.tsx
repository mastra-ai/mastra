import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { releaseBoard } from '../../e2e/ui/board-catalog';
import { server } from '../../e2e/ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle } from '../../e2e/ui/render';
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
  description: null,
  revision: 4,
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z',
};
const wireItem = { ...item, factoryProjectId: 'fp-1', externalSource: null };

describe('custom board operations', () => {
  beforeEach(() => {
    server.use(http.get('*/web/factory/projects/:id/boards', () => HttpResponse.json({ boards: [releaseBoard] })));
  });

  it.each(['shipping', 'shipped', 'execute'])('does not dispatch a drag to undeclared destination %s', async stage => {
    const transition = vi.fn(() => HttpResponse.json({}));
    server.use(http.post('*/web/factory/projects/:id/work-items/:itemId/transition', transition));
    const { result, client } = renderHookWithProviders(() =>
      useBoardItems({ factoryProjectId: 'fp-1', kind: 'release', items: [item] }),
    );
    await waitForMutationsIdle(client);
    act(() =>
      result.current.handleDrop({ kind: 'work-item', id: item.id, fromStage: 'queued', ownerKind: 'free' }, stage),
    );
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
    server.use(http.post('*/web/factory/projects/:id/work-items/:itemId/transition', transition));
    const { result, client } = renderHookWithProviders(() =>
      useBoardItems({ factoryProjectId: 'fp-1', kind, items: [item] }),
    );
    await waitForMutationsIdle(client);
    act(() =>
      result.current.handleDrop(
        { kind: 'work-item', id: item.id, fromStage: 'queued', ownerKind: 'free' },
        'preparing',
      ),
    );
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

  it.each(['approval_required', 'stale_revision'])(
    'sends the persisted board and revision and preserves %s rejection',
    async code => {
      let body: unknown;
      server.use(
        http.post('*/web/factory/projects/:id/work-items/:itemId/transition', async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({
            result: { status: 'rejected', transitionId: 'transition-1', itemId: item.id, code, reason: code },
          });
        }),
      );
      const { result, client } = renderHookWithProviders(() =>
        useBoardItems({ factoryProjectId: 'fp-1', kind: 'release', items: [item] }),
      );
      await waitForMutationsIdle(client);
      act(() => result.current.move(item.id, 'preparing'));
      await waitFor(() => expect(result.current.transitionReasons[item.id]).toBe(code));
      expect(body).toMatchObject({ board: 'release', stage: 'preparing', expectedRevision: 4 });
    },
  );

  it('links custom-board cards through the custom route', () => {
    expect(
      factoryAttentionTargetPath('fp-1', {
        kind: 'work-item',
        board: 'release',
        workItemId: item.id,
      }),
    ).toBe('/factories/fp-1/boards/release?item=release-1');
  });
});
