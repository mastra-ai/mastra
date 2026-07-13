import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '#test/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '#test/render';

import { useDirectoryListing } from '../use-fs';
import { listing } from './fixtures/fs';

const URL = `${TEST_BASE_URL}/web/fs/list`;

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
