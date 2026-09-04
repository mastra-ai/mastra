// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInfiniteDatasets } from '../use-datasets';
import { server } from '@/test/msw-server';
import { makeWrapper } from '@/test/render';

const makeDataset = (id: string) => ({
  id,
  name: `Dataset ${id}`,
  description: '',
  version: 1,
  tags: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

afterEach(() => cleanup());

describe('useInfiniteDatasets', () => {
  it('loads the first page and appends the next page while the server reports more', async () => {
    const onRequest = vi.fn<(url: URL) => void>();
    server.use(
      http.get('*/api/datasets', ({ request }) => {
        const url = new URL(request.url);
        onRequest(url);
        const page = Number(url.searchParams.get('page'));
        return HttpResponse.json({
          datasets: [makeDataset(`ds-${page}`)],
          pagination: { total: 2, page, perPage: 20, hasMore: page === 0 },
        });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useInfiniteDatasets(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onRequest.mock.calls[0][0].searchParams.get('page')).toBe('0');
    expect(onRequest.mock.calls[0][0].searchParams.get('perPage')).toBe('20');
    expect(result.current.data?.map(d => d.id)).toEqual(['ds-0']);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.data?.map(d => d.id)).toEqual(['ds-0', 'ds-1']));
    expect(onRequest.mock.calls[1][0].searchParams.get('page')).toBe('1');
    expect(result.current.hasNextPage).toBe(false);
  });
});
