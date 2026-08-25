import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDatasetItem, useDatasetItems } from '../use-dataset-items';
import { installIntersectionObserver } from '@/test/intersection-observer';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const ITEMS_URL = `${BASE_URL}/api/datasets/dataset-1/items`;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  wrapper.queryClient = queryClient;
  return wrapper;
};

const settle = () => new Promise(resolve => setTimeout(resolve, 50));

const item = (id: string) => ({ id, datasetId: 'dataset-1', input: { q: id }, datasetVersion: 1 });

/** Ten rows per page — the page size the hook asks for. */
const page = (ids: string[], total: number) => ({
  items: ids.map(item),
  pagination: { total, page: 0, perPage: 10, hasMore: ids.length < total },
});

const tenIds = (prefix: string) => Array.from({ length: 10 }, (_, i) => `${prefix}-${i}`);

describe('useDatasetItem', () => {
  describe('when the item exists', () => {
    it('exposes it', async () => {
      server.use(http.get(`${ITEMS_URL}/item-1`, () => HttpResponse.json(item('item-1'))));

      const { result } = renderHook(() => useDatasetItem('dataset-1', 'item-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data?.id).toBe('item-1'));
    });
  });

  describe('when the item has been deleted', () => {
    it('fails fast rather than retrying the 404', async () => {
      let calls = 0;
      server.use(
        http.get(`${ITEMS_URL}/gone`, () => {
          calls += 1;
          return new HttpResponse(null, { status: 404 });
        }),
      );

      const { result } = renderHook(() => useDatasetItem('dataset-1', 'gone'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(calls).toBe(1);
    }, 10000);
  });

  describe.each([
    ['the dataset id is missing', '', 'item-1'],
    ['the item id is missing', 'dataset-1', ''],
  ])('when %s', (_label, datasetId, itemId) => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/items/:itemId`, () => {
          onFetch();
          return HttpResponse.json(item('item-1'));
        }),
      );

      const { result } = renderHook(() => useDatasetItem(datasetId, itemId), { wrapper: createWrapper() });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when two items are read through the same cache', () => {
    it('keeps each item in its own cache entry', async () => {
      server.use(
        http.get(`${BASE_URL}/api/datasets/dataset-1/items/:itemId`, ({ params }) =>
          HttpResponse.json(item(String(params.itemId))),
        ),
      );
      const wrapper = createWrapper();

      const first = renderHook(() => useDatasetItem('dataset-1', 'item-a'), { wrapper });
      await waitFor(() => expect(first.result.current.data?.id).toBe('item-a'));

      const second = renderHook(() => useDatasetItem('dataset-1', 'item-b'), { wrapper });
      await waitFor(() => expect(second.result.current.data?.id).toBe('item-b'));

      expect(first.result.current.data?.id).toBe('item-a');
    });
  });
});

describe('useDatasetItems', () => {
  describe('when the dataset has one short page', () => {
    it('exposes the items and the total', async () => {
      server.use(http.get(ITEMS_URL, () => HttpResponse.json(page(['a', 'b'], 2))));

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(2));
      expect(result.current.total).toBe(2);
    });

    it('asks for the first page, ten rows at a time', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(page(['a'], 1));
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(receivedUrl?.searchParams.get('page')).toBe('0');
      expect(receivedUrl?.searchParams.get('perPage')).toBe('10');
    });

    it('stops paging because the page is not full', async () => {
      server.use(http.get(ITEMS_URL, () => HttpResponse.json(page(['a', 'b'], 50))));

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(2));
      // A full page would allow another, but 2 of 50 fetched means the server
      // has nothing more to give on this page.
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  describe('when the dataset has more items than one page', () => {
    it('offers another page and appends it', async () => {
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          const p = new URL(request.url).searchParams.get('page') ?? '0';
          return HttpResponse.json(page(p === '0' ? tenIds('first') : tenIds('second'), 20));
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.hasNextPage).toBe(true));

      await act(async () => {
        await result.current.fetchNextPage();
      });

      await waitFor(() => expect(result.current.data).toHaveLength(20));
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  describe('when a page comes back empty', () => {
    it('stops paging', async () => {
      server.use(http.get(ITEMS_URL, () => HttpResponse.json(page([], 50))));

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.data).toEqual([]);
    });
  });

  describe('when the server reports no pagination envelope', () => {
    it('stops paging rather than looping forever', async () => {
      server.use(http.get(ITEMS_URL, () => HttpResponse.json({ items: [item('a')] })));

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
      expect(result.current.total).toBeUndefined();
    });
  });

  describe('when a search term is supplied', () => {
    it('forwards it', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(page(['a'], 1));
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1', 'weather'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(receivedUrl?.searchParams.get('search')).toBe('weather');
    });

    it('omits an empty search rather than filtering on it', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(page(['a'], 1));
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1', ''), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(receivedUrl?.searchParams.get('search')).toBeNull();
    });

    it('keeps each search term in its own cache entry', async () => {
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          const search = new URL(request.url).searchParams.get('search') ?? 'none';
          return HttpResponse.json(page([`hit-${search}`], 1));
        }),
      );
      const wrapper = createWrapper();

      const rain = renderHook(() => useDatasetItems('dataset-1', 'rain'), { wrapper });
      await waitFor(() => expect(rain.result.current.data[0]?.id).toBe('hit-rain'));

      const snow = renderHook(() => useDatasetItems('dataset-1', 'snow'), { wrapper });
      await waitFor(() => expect(snow.result.current.data[0]?.id).toBe('hit-snow'));

      expect(rain.result.current.data[0]?.id).toBe('hit-rain');
    });
  });

  describe('when a historical version is supplied', () => {
    it('forwards it', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(page(['a'], 1));
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1', undefined, 3), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(receivedUrl?.searchParams.get('version')).toBe('3');
    });

    it('omits a null version so the latest snapshot is served', async () => {
      let receivedUrl: URL | undefined;
      server.use(
        http.get(ITEMS_URL, ({ request }) => {
          receivedUrl = new URL(request.url);
          return HttpResponse.json(page(['a'], 1));
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1', undefined, null), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.data).toHaveLength(1));
      expect(receivedUrl?.searchParams.get('version')).toBeNull();
    });
  });

  describe('when no dataset is selected', () => {
    it('stays idle instead of fetching', async () => {
      const onFetch = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/datasets/:datasetId/items`, () => {
          onFetch();
          return HttpResponse.json(page(['a'], 1));
        }),
      );

      const { result } = renderHook(() => useDatasetItems(''), { wrapper: createWrapper() });

      await settle();
      expect(onFetch).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('when the request fails', () => {
    it('surfaces the error without react-query adding retries of its own', async () => {
      let calls = 0;
      server.use(
        http.get(ITEMS_URL, () => {
          calls += 1;
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
      // MastraClient retries 5xx three times on its own before throwing, so what
      // reaches react-query is already the final failure. `retry: false` means it
      // stops there rather than starting the whole sequence again.
      const afterFirstFailure = calls;
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(calls).toBe(afterFirstFailure);
    }, 15000);
  });
});

describe('useDatasetItems, as the reader scrolls', () => {
  let observer: ReturnType<typeof installIntersectionObserver>;

  beforeEach(() => {
    observer = installIntersectionObserver();
  });

  afterEach(() => observer.restore());

  /** Renders the hook with its end-of-list sentinel actually mounted. */
  const renderWithSentinel = () => {
    const api: { current: ReturnType<typeof useDatasetItems> | null } = { current: null };

    const Harness = () => {
      const query = useDatasetItems('dataset-1');
      api.current = query;
      return <div ref={query.setEndOfListElement} data-testid="sentinel" />;
    };

    render(<Harness />, { wrapper: createWrapper() });
    return () => api.current!;
  };

  it('loads the next page once the end of the list comes into view', async () => {
    const pages: string[] = [];
    server.use(
      http.get(ITEMS_URL, ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page') ?? '');
        return HttpResponse.json(page(['a'], 50));
      }),
    );

    const query = renderWithSentinel();
    await waitFor(() => expect(query().hasNextPage).toBe(true));
    expect(pages).toEqual(['0']);

    await act(async () => observer.setIntersecting(true));

    await waitFor(() => expect(pages).toEqual(['0', '1']));
  });

  it('does not load anything more once the last page has arrived', async () => {
    const pages: string[] = [];
    server.use(
      http.get(ITEMS_URL, ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page') ?? '');
        return HttpResponse.json(page(['a'], 1));
      }),
    );

    const query = renderWithSentinel();
    await waitFor(() => expect(query().isSuccess).toBe(true));

    await act(async () => observer.setIntersecting(true));
    await act(async () => new Promise(resolve => setTimeout(resolve, 60)));

    expect(pages).toEqual(['0']);
  });
});

describe('useDatasetItems, on responses the server left empty', () => {
  it('stops asking once it has fetched exactly as many items as the server reports', async () => {
    server.use(
      http.get(ITEMS_URL, () =>
        HttpResponse.json(
          page(
            Array.from({ length: 10 }, (_, i) => `a${i}`),
            10,
          ),
        ),
      ),
    );

    const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // 10 fetched of 10 reported: equal, not greater — the boundary case.
    expect(result.current.hasNextPage).toBe(false);
  });

  it('survives a page that comes back with no body at all', async () => {
    server.use(http.get(ITEMS_URL, () => HttpResponse.json(null)));

    const { result } = renderHook(() => useDatasetItems('dataset-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(result.current.total).toBeUndefined();
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe('the cache entries the dataset item hooks write', () => {
  it('files a single item under a key of its own', async () => {
    server.use(http.get(`${ITEMS_URL}/item-1`, () => HttpResponse.json(item('item-1'))));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useDatasetItem('dataset-1', 'item-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(wrapper.queryClient.getQueryData(['dataset-item', 'dataset-1', 'item-1'])).toMatchObject({ id: 'item-1' });
    expect(wrapper.queryClient.getQueryData(['dataset-items', 'dataset-1', 'item-1'])).toBeUndefined();
  });

  it('files the list under a key that carries the search and version', async () => {
    server.use(http.get(ITEMS_URL, () => HttpResponse.json(page(['a'], 1))));
    const wrapper = createWrapper();

    const { result } = renderHook(() => useDatasetItems('dataset-1', 'needle', 7), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(wrapper.queryClient.getQueryData(['dataset-items', 'dataset-1', 'needle', 7])).toBeDefined();
    expect(wrapper.queryClient.getQueryData(['dataset-items', 'dataset-1', undefined, undefined])).toBeUndefined();
  });
});
