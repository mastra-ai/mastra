import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';
import { useStoredPromptBlock, useStoredPromptBlockMutations, useStoredPromptBlocks } from '../use-stored-prompt-blocks';
import { PROMPT_BLOCK_ID, makeStoredPromptBlock, makeStoredPromptBlocksList } from './fixtures/editor-prompt-blocks';



describe('when Studio users manage prompt blocks', () => {
  it('lists and reads prompt blocks with status and pagination params preserved', async () => {
    const block = makeStoredPromptBlock({ status: 'published', hasDraft: true });
    let listUrl: URL | undefined;
    let detailUrl: URL | undefined;

    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks`, ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json(makeStoredPromptBlocksList([block]));
      }),
      http.get(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}`, ({ request }) => {
        detailUrl = new URL(request.url);
        return HttpResponse.json(block);
      }),
    );

    const { wrapper } = makeWrapper();
    const list = renderHook(
      () =>
        useStoredPromptBlocks({
          page: 2,
          perPage: 5,
          status: 'published',
          authorId: 'user-1',
          orderBy: { field: 'updatedAt', direction: 'DESC' },
        }),
      { wrapper },
    );
    const detail = renderHook(() => useStoredPromptBlock(PROMPT_BLOCK_ID, { status: 'published' }), { wrapper });

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(detail.result.current.isSuccess).toBe(true));

    expect(list.result.current.data?.promptBlocks).toEqual([block]);
    expect(detail.result.current.data).toEqual(block);
    expect(listUrl?.searchParams.get('page')).toBe('2');
    expect(listUrl?.searchParams.get('perPage')).toBe('5');
    expect(listUrl?.searchParams.get('status')).toBe('published');
    expect(listUrl?.searchParams.get('authorId')).toBe('user-1');
    expect(listUrl?.searchParams.get('orderBy[field]')).toBe('updatedAt');
    expect(listUrl?.searchParams.get('orderBy[direction]')).toBe('DESC');
    expect(detailUrl?.searchParams.get('status')).toBe('published');
  });

  it('creates, updates, and deletes prompt blocks while invalidating Studio caches', async () => {
    const created = makeStoredPromptBlock({ name: 'Created prompt block' });
    const updated = makeStoredPromptBlock({ name: 'Updated prompt block', content: 'Updated {{topic}}' });
    const seenBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post(`${TEST_BASE_URL}/api/stored/prompt-blocks`, async ({ request }) => {
        seenBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(created);
      }),
      http.patch(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}`, async ({ request }) => {
        seenBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(updated);
      }),
      http.delete(`${TEST_BASE_URL}/api/stored/prompt-blocks/${PROMPT_BLOCK_ID}`, () =>
        HttpResponse.json({ success: true, message: 'Prompt block deleted' }),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['stored-prompt-blocks'], makeStoredPromptBlocksList([created]));
    queryClient.setQueryData(['stored-prompt-block', PROMPT_BLOCK_ID, 'draft', undefined], created);
    queryClient.setQueryData(['prompt-block-versions', PROMPT_BLOCK_ID], { versions: [], total: 0, page: 1, perPage: 50, hasMore: false });

    const { result } = renderHook(() => useStoredPromptBlockMutations(PROMPT_BLOCK_ID), { wrapper });

    await result.current.createStoredPromptBlock.mutateAsync({ name: 'Created prompt block', content: 'Hello {{name}}' });
    await result.current.updateStoredPromptBlock.mutateAsync({ content: 'Updated {{topic}}' });
    await result.current.deleteStoredPromptBlock.mutateAsync();
    await waitForMutationsIdle(queryClient);

    await waitFor(() => expect(queryClient.getQueryState(['stored-prompt-blocks'])?.isInvalidated).toBe(true));
    expect(queryClient.getQueriesData({ queryKey: ['stored-prompt-block', PROMPT_BLOCK_ID] }).length).toBeGreaterThan(0);
    expect(queryClient.getQueryState(['prompt-block-versions', PROMPT_BLOCK_ID])?.isInvalidated).toBe(true);
    expect(seenBodies).toEqual([{ name: 'Created prompt block', content: 'Hello {{name}}' }, { content: 'Updated {{topic}}' }]);
  });
});
