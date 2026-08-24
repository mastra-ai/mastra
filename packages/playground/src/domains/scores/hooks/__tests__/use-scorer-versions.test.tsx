import { usePlaygroundStore } from '@mastra/playground-ui/store/playground-store';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  useActivateScorerVersion,
  useCompareScorerVersions,
  useCreateScorerVersion,
  useDeleteScorerVersion,
  useRestoreScorerVersion,
  useScorerVersion,
  useScorerVersions,
} from '../use-scorer-versions';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SCORER_ID = 'scorer-1';
const VERSIONS_URL = `${BASE_URL}/api/stored/scorers/${SCORER_ID}/versions`;

type Seen = { method: string; path: string; search: string };

/** Records every request that reaches the scorer-version endpoints. */
const captureVersions = (body: unknown = { id: 'v-1' }) => {
  const seen: Seen[] = [];
  const record = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    seen.push({ method: request.method, path: url.pathname, search: url.search });
    return HttpResponse.json(body);
  };

  server.use(
    http.get(`${VERSIONS_URL}/*`, record),
    http.post(`${VERSIONS_URL}/*`, record),
    http.delete(`${VERSIONS_URL}/*`, record),
    http.get(VERSIONS_URL, record),
    http.post(VERSIONS_URL, record),
  );
  return seen;
};

const SEEDED_KEYS: readonly unknown[][] = [
  ['scorer-versions', SCORER_ID],
  ['scorer-versions', 'scorer-other'],
  ['stored-scorer', SCORER_ID],
  ['stored-scorer', 'scorer-other'],
];

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of SEEDED_KEYS) queryClient.setQueryData(key, { seeded: true });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
  return { wrapper, queryClient };
};

/** The seeded keys that ended up marked stale, as readable strings. */
const invalidated = (queryClient: QueryClient) =>
  SEEDED_KEYS.filter(key => queryClient.getQueryState(key)?.isInvalidated)
    .map(key => key.join('/'))
    .sort();

/** Lets react-query settle so "no request was made" is a real observation. */
const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 60)));

beforeEach(() => usePlaygroundStore.setState({ requestContext: {} }));
afterEach(() => cleanup());

describe('useScorerVersions', () => {
  it('lists the versions of a scorer', async () => {
    const seen = captureVersions({ versions: [{ id: 'v-1' }] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useScorerVersions({ scorerId: SCORER_ID }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]).toMatchObject({ method: 'GET', path: `/api/stored/scorers/${SCORER_ID}/versions` });
  });

  it('forwards the list params the caller asked for', async () => {
    const seen = captureVersions({ versions: [] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useScorerVersions({ scorerId: SCORER_ID, params: { page: 2 } as never }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].search).toContain('page=2');
  });

  it('keeps each params combination in its own cache entry', async () => {
    captureVersions({ versions: [] });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useScorerVersions({ scorerId: SCORER_ID, params: { page: 2 } as never }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['scorer-versions', SCORER_ID, { page: 2 }, {}])).toBeDefined();
    expect(queryClient.getQueryData(['scorer-versions', SCORER_ID, undefined, {}])).toBeUndefined();
  });

  it('stays idle without a scorer id', async () => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useScorerVersions({ scorerId: '' }), { wrapper });

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useScorerVersion', () => {
  it('reads one version by its id', async () => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useScorerVersion({ scorerId: SCORER_ID, versionId: 'v-7' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0]).toMatchObject({ method: 'GET', path: `/api/stored/scorers/${SCORER_ID}/versions/v-7` });
  });

  it('keeps each version in its own cache entry', async () => {
    captureVersions();
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useScorerVersion({ scorerId: SCORER_ID, versionId: 'v-7' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['scorer-version', SCORER_ID, 'v-7', {}])).toBeDefined();
    expect(queryClient.getQueryData(['scorer-version', SCORER_ID, 'v-8', {}])).toBeUndefined();
  });

  it.each([
    ['no scorer', '', 'v-7'],
    ['no version', SCORER_ID, ''],
  ])('stays idle with %s', async (_label, scorerId, versionId) => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useScorerVersion({ scorerId, versionId }), { wrapper });

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('the version mutations', () => {
  it('creates a version', async () => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useCreateScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/stored/scorers/${SCORER_ID}/versions` });
  });

  it('activates a version', async () => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useActivateScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('v-7');
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/stored/scorers/${SCORER_ID}/versions/v-7/activate` });
  });

  it('restores a version', async () => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useRestoreScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('v-7');
    });

    expect(seen[0]).toMatchObject({ method: 'POST', path: `/api/stored/scorers/${SCORER_ID}/versions/v-7/restore` });
  });

  it('deletes a version', async () => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useDeleteScorerVersion({ scorerId: SCORER_ID }), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('v-7');
    });

    expect(seen[0]).toMatchObject({ method: 'DELETE', path: `/api/stored/scorers/${SCORER_ID}/versions/v-7` });
  });

  describe('the caches they refresh', () => {
    it.each([
      ['creating', () => useCreateScorerVersion({ scorerId: SCORER_ID }), undefined as unknown as string],
      ['activating', () => useActivateScorerVersion({ scorerId: SCORER_ID }), 'v-7'],
      ['restoring', () => useRestoreScorerVersion({ scorerId: SCORER_ID }), 'v-7'],
    ])('refreshes the version list and the scorer itself after %s', async (_label, useHook, arg) => {
      captureVersions();
      const { wrapper, queryClient } = setup();

      const { result } = renderHook(useHook, { wrapper });
      await act(async () => {
        await (result.current.mutateAsync as (value: unknown) => Promise<unknown>)(arg);
      });

      expect(invalidated(queryClient)).toEqual([`scorer-versions/${SCORER_ID}`, `stored-scorer/${SCORER_ID}`]);
    });

    it('refreshes only the version list after a delete', async () => {
      captureVersions();
      const { wrapper, queryClient } = setup();

      const { result } = renderHook(() => useDeleteScorerVersion({ scorerId: SCORER_ID }), { wrapper });
      await act(async () => {
        await result.current.mutateAsync('v-7');
      });

      expect(invalidated(queryClient)).toEqual([`scorer-versions/${SCORER_ID}`]);
    });

    it('leaves the caches alone when the write fails', async () => {
      server.use(http.post(VERSIONS_URL, () => new HttpResponse(null, { status: 500 })));
      const { wrapper, queryClient } = setup();

      const { result } = renderHook(() => useCreateScorerVersion({ scorerId: SCORER_ID }), { wrapper });
      await act(async () => {
        await result.current.mutateAsync(undefined).catch(() => {});
      });

      expect(invalidated(queryClient)).toEqual([]);
    });
  });
});

describe('useCompareScorerVersions', () => {
  it('asks the server to diff the two versions the caller named', async () => {
    const seen = captureVersions({ changes: [] });
    const { wrapper } = setup();

    const { result } = renderHook(
      () => useCompareScorerVersions({ scorerId: SCORER_ID, fromVersionId: 'v-1', toVersionId: 'v-2' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].path).toBe(`/api/stored/scorers/${SCORER_ID}/versions/compare`);
    expect(seen[0].search).toContain('from=v-1');
    expect(seen[0].search).toContain('to=v-2');
  });

  it('keeps each pair of versions in its own cache entry', async () => {
    captureVersions({ changes: [] });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(
      () => useCompareScorerVersions({ scorerId: SCORER_ID, fromVersionId: 'v-1', toVersionId: 'v-2' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(['scorer-versions-compare', SCORER_ID, 'v-1', 'v-2', {}])).toBeDefined();
    expect(queryClient.getQueryData(['scorer-versions-compare', SCORER_ID, 'v-2', 'v-1', {}])).toBeUndefined();
  });

  it.each([
    ['no scorer', { scorerId: '', fromVersionId: 'v-1', toVersionId: 'v-2' }],
    ['no from version', { scorerId: SCORER_ID, fromVersionId: '', toVersionId: 'v-2' }],
    ['no to version', { scorerId: SCORER_ID, fromVersionId: 'v-1', toVersionId: '' }],
  ])('stays idle with %s', async (_label, args) => {
    const seen = captureVersions();
    const { wrapper } = setup();

    const { result } = renderHook(() => useCompareScorerVersions(args), { wrapper });

    await settle();
    expect(seen).toEqual([]);
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('the request context the studio is scoped to', () => {
  it('travels with a version read and keys its cache entry', async () => {
    usePlaygroundStore.setState({ requestContext: { tenant: 'acme' } });
    const seen = captureVersions({ versions: [] });
    const { wrapper, queryClient } = setup();

    const { result } = renderHook(() => useScorerVersions({ scorerId: SCORER_ID }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen[0].search).not.toBe('');
    expect(queryClient.getQueryData(['scorer-versions', SCORER_ID, undefined, { tenant: 'acme' }])).toBeDefined();
  });
});
