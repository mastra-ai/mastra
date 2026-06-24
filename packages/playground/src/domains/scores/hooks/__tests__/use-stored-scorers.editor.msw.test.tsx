import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';
import { useStoredScorer, useStoredScorerMutations } from '../use-stored-scorers';
import { SCORER_ID, makeStoredScorer, makeStoredScorersList } from './fixtures/editor-scorers';

describe('when Studio users manage scorers', () => {
  it('reads scorer details with status params preserved', async () => {
    const scorer = makeStoredScorer({ status: 'published' });
    let detailUrl: URL | undefined;

    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}`, ({ request }) => {
        detailUrl = new URL(request.url);
        return HttpResponse.json(scorer);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useStoredScorer(SCORER_ID, { status: 'published' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(scorer);
    expect(detailUrl?.searchParams.get('status')).toBe('published');
  });

  it('creates, updates, and deletes scorer definitions while invalidating Studio caches', async () => {
    const created = makeStoredScorer({ name: 'Created scorer' });
    const updated = makeStoredScorer({ name: 'Updated scorer', instructions: 'Updated rubric' });
    const seenBodies: unknown[] = [];

    server.use(
      http.post(`${TEST_BASE_URL}/api/stored/scorers`, async ({ request }) => {
        seenBodies.push(await request.json());
        return HttpResponse.json(created);
      }),
      http.patch(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}`, async ({ request }) => {
        seenBodies.push(await request.json());
        return HttpResponse.json(updated);
      }),
      http.delete(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}`, () =>
        HttpResponse.json({ success: true, message: 'Scorer deleted' }),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['stored-scorers'], makeStoredScorersList([created]));
    queryClient.setQueryData(['scorers'], { scorers: [created] });
    queryClient.setQueryData(['stored-scorer', SCORER_ID, 'draft', undefined], created);

    const { result } = renderHook(() => useStoredScorerMutations(SCORER_ID), { wrapper });

    await result.current.createStoredScorer.mutateAsync({
      name: 'Created scorer',
      type: 'llm-judge',
      instructions: 'Score quality.',
    });
    await result.current.updateStoredScorer.mutateAsync({ instructions: 'Updated rubric' });
    await result.current.deleteStoredScorer.mutateAsync();
    await waitForMutationsIdle(queryClient);

    await waitFor(() => expect(queryClient.getQueryState(['stored-scorers'])?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(['scorers'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueriesData({ queryKey: ['stored-scorer', SCORER_ID] }).length).toBeGreaterThan(0);
    expect(seenBodies).toEqual([
      { name: 'Created scorer', type: 'llm-judge', instructions: 'Score quality.' },
      { instructions: 'Updated rubric' },
    ]);
  });
});
