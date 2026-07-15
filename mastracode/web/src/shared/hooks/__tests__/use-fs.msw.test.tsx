import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '../../../../e2e/web-ui/render';
import { useArtifactListing, useDirectoryListing } from '../use-fs';
import { listing } from './fixtures/fs';

const URL = `${TEST_BASE_URL}/web/fs/list`;
const ARTIFACTS_URL = `${TEST_BASE_URL}/web/artifacts/list`;

describe('useDirectoryListing', () => {
  describe('when no path is provided', () => {
    it('lists the root without a path query param', async () => {
      let seenPath: string | null = null;
      server.use(
        http.get(URL, ({ request }) => {
          seenPath = new global.URL(request.url).searchParams.get('path');
          return HttpResponse.json(listing('/home/user', ['projects']));
        }),
      );

      const { result } = renderHookWithProviders(() => useDirectoryListing(undefined));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(seenPath).toBe(null);
      expect(result.current.data?.path).toBe('/home/user');
      expect(result.current.data?.entries).toHaveLength(1);
    });
  });

  describe('when a path changes', () => {
    it('refetches the listing for the new path', async () => {
      server.use(
        http.get(URL, ({ request }) => {
          const path = new global.URL(request.url).searchParams.get('path');
          if (path === '/home/user/projects') {
            return HttpResponse.json(listing('/home/user/projects', ['app'], '/home/user'));
          }
          return HttpResponse.json(listing('/home/user', ['projects']));
        }),
      );

      const { result, rerender } = renderHookWithProviders(({ path }: { path?: string }) => useDirectoryListing(path), {
        initialProps: { path: undefined as string | undefined },
      });

      await waitFor(() => expect(result.current.data?.path).toBe('/home/user'));

      rerender({ path: '/home/user/projects' });

      await waitFor(() => expect(result.current.data?.path).toBe('/home/user/projects'));
      expect(result.current.data?.entries[0]?.name).toBe('app');
    });
  });

  describe('when the list fails', () => {
    it('surfaces the error', async () => {
      server.use(http.get(URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

      const { result } = renderHookWithProviders(() => useDirectoryListing('/home/user'));

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});

describe('useArtifactListing', () => {
  it('does not fetch until a workspace path is available', () => {
    let called = false;
    server.use(
      http.get(ARTIFACTS_URL, () => {
        called = true;
        return HttpResponse.json({ rootPath: '', artifactsPath: '', entries: [] });
      }),
    );

    const { result } = renderHookWithProviders(() => useArtifactListing(undefined));

    expect(result.current.fetchStatus).toBe('idle');
    expect(called).toBe(false);
  });

  it('fetches artifacts for the workspace path', async () => {
    let seenPath: string | null = null;
    server.use(
      http.get(ARTIFACTS_URL, ({ request }) => {
        seenPath = new global.URL(request.url).searchParams.get('path');
        return HttpResponse.json({
          rootPath: '/home/user/project',
          artifactsPath: '/home/user/project/.artifacts',
          entries: [{ name: 'HISTORY.md', path: 'understand-pr/HISTORY.md', type: 'file', size: 5, updatedAt: '2026-07-15T00:00:00.000Z' }],
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useArtifactListing('/home/user/project'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenPath).toBe('/home/user/project');
    expect(result.current.data?.entries[0]?.path).toBe('understand-pr/HISTORY.md');
  });
});
