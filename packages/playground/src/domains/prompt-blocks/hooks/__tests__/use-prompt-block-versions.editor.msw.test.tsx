import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';
import {
  useActivatePromptBlockVersion,
  useCreatePromptBlockVersion,
  useDeletePromptBlockVersion,
  usePromptBlockVersion,
  usePromptBlockVersions,
  useRestorePromptBlockVersion,
} from '../use-prompt-block-versions';
import {
  PROMPT_BLOCK_ID,
  PROMPT_BLOCK_VERSION_ID,
  activatedPromptBlockVersion,
  deletedPromptBlockVersion,
  makePromptBlockVersion,
  makePromptBlockVersionsList,
} from './fixtures/editor-prompt-blocks';



describe('when Studio users publish prompt block versions', () => {
  it('loads prompt block versions and forwards version route params', async () => {
    const version = makePromptBlockVersion();
    let listUrl: URL | undefined;

    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}/versions`, ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json(makePromptBlockVersionsList([version]));
      }),
      http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}/versions/${PROMPT_BLOCK_VERSION_ID}`, () =>
        HttpResponse.json(version),
      ),
    );

    const { wrapper } = makeWrapper();
    const list = renderHook(
      () =>
        usePromptBlockVersions({
          blockId: PROMPT_BLOCK_ID,
          params: { page: 3, perPage: 2, orderBy: { field: 'versionNumber', direction: 'DESC' } },
        }),
      { wrapper },
    );
    const detail = renderHook(() => usePromptBlockVersion({ blockId: PROMPT_BLOCK_ID, versionId: PROMPT_BLOCK_VERSION_ID }), { wrapper });

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));

    expect(list.result.current.data?.versions).toEqual([version]);
    expect(detail.result.current.data).toEqual(version);
    expect(listUrl?.searchParams.get('page')).toBe('3');
    expect(listUrl?.searchParams.get('perPage')).toBe('2');
    expect(listUrl?.searchParams.get('orderBy[field]')).toBe('versionNumber');
    expect(listUrl?.searchParams.get('orderBy[direction]')).toBe('DESC');
  });

  it('creates, activates, restores, and deletes prompt block versions with cache invalidation', async () => {
    const newVersion = makePromptBlockVersion({ id: 'prompt-block-version-2', versionNumber: 2 });

    server.use(
      http.post(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}/versions`, () => HttpResponse.json(newVersion)),
      http.post(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}/versions/prompt-block-version-2/activate`, () =>
        HttpResponse.json(activatedPromptBlockVersion),
      ),
      http.post(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}/versions/${PROMPT_BLOCK_VERSION_ID}/restore`, () =>
        HttpResponse.json(newVersion),
      ),
      http.delete(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}/versions/${PROMPT_BLOCK_VERSION_ID}`, () =>
        HttpResponse.json(deletedPromptBlockVersion),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['prompt-block-versions', PROMPT_BLOCK_ID], makePromptBlockVersionsList([makePromptBlockVersion()]));
    queryClient.setQueryData(['stored-prompt-block', PROMPT_BLOCK_ID], { id: PROMPT_BLOCK_ID });

    const create = renderHook(() => useCreatePromptBlockVersion({ blockId: PROMPT_BLOCK_ID }), { wrapper });
    const activate = renderHook(() => useActivatePromptBlockVersion({ blockId: PROMPT_BLOCK_ID }), { wrapper });
    const restore = renderHook(() => useRestorePromptBlockVersion({ blockId: PROMPT_BLOCK_ID }), { wrapper });
    const remove = renderHook(() => useDeletePromptBlockVersion({ blockId: PROMPT_BLOCK_ID }), { wrapper });

    await create.result.current.mutateAsync({ changeMessage: 'Save prompt preview changes' });
    await activate.result.current.mutateAsync('prompt-block-version-2');
    await restore.result.current.mutateAsync(PROMPT_BLOCK_VERSION_ID);
    await remove.result.current.mutateAsync(PROMPT_BLOCK_VERSION_ID);
    await waitForMutationsIdle(queryClient);

    await waitFor(() => expect(queryClient.getQueryState(['prompt-block-versions', PROMPT_BLOCK_ID])?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(['stored-prompt-block', PROMPT_BLOCK_ID])?.isInvalidated).toBe(true);
  });
});
