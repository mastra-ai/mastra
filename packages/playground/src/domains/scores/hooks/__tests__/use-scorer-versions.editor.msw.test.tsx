import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';
import {
  useActivateScorerVersion,
  useCompareScorerVersions,
  useCreateScorerVersion,
  useDeleteScorerVersion,
  useRestoreScorerVersion,
  useScorerVersion,
  useScorerVersions,
} from '../use-scorer-versions';
import {
  SCORER_ID,
  SCORER_VERSION_ID,
  activatedScorerVersion,
  deletedScorerVersion,
  makeScorerVersion,
  makeScorerVersionsList,
  scorerVersionCompare,
} from './fixtures/editor-scorers';



describe('when Studio users publish scorer versions', () => {
  it('loads, reads, and compares scorer versions with literal compare route preserved', async () => {
    const version = makeScorerVersion();
    let listUrl: URL | undefined;
    let compareUrl: URL | undefined;

    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions`, ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json(makeScorerVersionsList([version]));
      }),
      http.get(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions/${SCORER_VERSION_ID}`, () => HttpResponse.json(version)),
      http.get(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions/compare`, ({ request }) => {
        compareUrl = new URL(request.url);
        return HttpResponse.json(scorerVersionCompare);
      }),
    );

    const { wrapper } = makeWrapper();
    const list = renderHook(
      () =>
        useScorerVersions({
          scorerId: SCORER_ID,
          params: { page: 2, perPage: 10, orderBy: { field: 'versionNumber', direction: 'DESC' } },
        }),
      { wrapper },
    );
    const detail = renderHook(() => useScorerVersion({ scorerId: SCORER_ID, versionId: SCORER_VERSION_ID }), { wrapper });
    const compare = renderHook(
      () => useCompareScorerVersions({ scorerId: SCORER_ID, fromVersionId: SCORER_VERSION_ID, toVersionId: 'scorer-version-2' }),
      { wrapper },
    );

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(compare.result.current.isSuccess).toBe(true));

    expect(list.result.current.data?.versions).toEqual([version]);
    expect(detail.result.current.data).toEqual(version);
    expect(compare.result.current.data?.diffs).toHaveLength(1);
    expect(listUrl?.searchParams.get('orderBy[field]')).toBe('versionNumber');
    expect(listUrl?.searchParams.get('orderBy[direction]')).toBe('DESC');
    expect(compareUrl?.searchParams.get('from')).toBe(SCORER_VERSION_ID);
    expect(compareUrl?.searchParams.get('to')).toBe('scorer-version-2');
  });

  it('creates, activates, restores, and deletes scorer versions with expected cache invalidation', async () => {
    const newVersion = makeScorerVersion({ id: 'scorer-version-2', versionNumber: 2 });

    server.use(
      http.post(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions`, () => HttpResponse.json(newVersion)),
      http.post(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions/scorer-version-2/activate`, () =>
        HttpResponse.json(activatedScorerVersion),
      ),
      http.post(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions/${SCORER_VERSION_ID}/restore`, () =>
        HttpResponse.json(newVersion),
      ),
      http.delete(`${TEST_BASE_URL}/api/stored/scorers/${SCORER_ID}/versions/${SCORER_VERSION_ID}`, () =>
        HttpResponse.json(deletedScorerVersion),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['scorer-versions', SCORER_ID], makeScorerVersionsList([makeScorerVersion()]));
    queryClient.setQueryData(['stored-scorer', SCORER_ID], { id: SCORER_ID });

    const create = renderHook(() => useCreateScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    const activate = renderHook(() => useActivateScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    const restore = renderHook(() => useRestoreScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    const remove = renderHook(() => useDeleteScorerVersion({ scorerId: SCORER_ID }), { wrapper });

    await create.result.current.mutateAsync({ changeMessage: 'Tune scorer rubric' });
    await activate.result.current.mutateAsync('scorer-version-2');
    await restore.result.current.mutateAsync(SCORER_VERSION_ID);
    await remove.result.current.mutateAsync(SCORER_VERSION_ID);
    await waitForMutationsIdle(queryClient);

    await waitFor(() => expect(queryClient.getQueryState(['scorer-versions', SCORER_ID])?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(['stored-scorer', SCORER_ID])?.isInvalidated).toBe(true);
  });
});
