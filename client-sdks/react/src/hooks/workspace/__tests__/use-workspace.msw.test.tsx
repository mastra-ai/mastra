// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MastraReactProvider } from '../../../mastra-react-provider';
import { useWorkspaceDirectory } from '../use-workspace-directory';
import { useWorkspaceFileContent } from '../use-workspace-file-content';
import { useWorkspaceSearch } from '../use-workspace-search';
import {
  BASE_URL,
  WORKSPACE_ID,
  WORKSPACE_URL,
  fileSearchResponse,
  listHandler,
  readHandler,
  rootListing,
  skillSearchResponse,
  readResponse,
} from './fixtures/workspace';

const server = setupServer();

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('useWorkspaceDirectory', () => {
  describe('when the directory exists', () => {
    it('returns its entries without listing recursively', async () => {
      const recursiveParams: Array<string | null> = [];
      server.use(
        http.get(`${WORKSPACE_URL}/fs/list`, ({ request }) => {
          recursiveParams.push(new URL(request.url).searchParams.get('recursive'));
          return HttpResponse.json(rootListing);
        }),
      );

      const { result } = renderHook(() => useWorkspaceDirectory(WORKSPACE_ID, '.'), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data).toEqual(rootListing.entries));
      expect(new Set(recursiveParams)).toEqual(new Set(['false']));
    });
  });

  describe('when disabled', () => {
    it('does not request the directory', () => {
      const { result } = renderHook(() => useWorkspaceDirectory(WORKSPACE_ID, '.', { enabled: false }), {
        wrapper: makeWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useWorkspaceFileContent', () => {
  describe('when a path is given', () => {
    it('returns the file content', async () => {
      server.use(readHandler());

      const { result } = renderHook(() => useWorkspaceFileContent(WORKSPACE_ID, 'src/index.ts'), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data?.content).toBe('const answer = 42;'));
    });
  });

  describe('when the path is an image', () => {
    it('requests base64 content', async () => {
      const encodings: (string | null)[] = [];
      server.use(
        http.get(`${WORKSPACE_URL}/fs/read`, ({ request }) => {
          encodings.push(new URL(request.url).searchParams.get('encoding'));
          return HttpResponse.json(readResponse('logo.png'));
        }),
      );

      const { result } = renderHook(() => useWorkspaceFileContent(WORKSPACE_ID, 'logo.png'), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data?.mimeType).toBe('image/png'));
      expect(new Set(encodings)).toEqual(new Set(['base64']));
    });
  });

  describe('when no path is given', () => {
    it('stays idle', () => {
      const { result } = renderHook(() => useWorkspaceFileContent(WORKSPACE_ID, undefined), { wrapper: makeWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useWorkspaceSearch', () => {
  describe('when file search is disabled', () => {
    it('only queries skills', async () => {
      server.use(http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json(skillSearchResponse)));

      const { result } = renderHook(() => useWorkspaceSearch(WORKSPACE_ID, 'hello', { files: false }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.data?.map(hit => hit.kind)).toEqual(['skill']));
    });
  });

  describe('when both files and skills match', () => {
    it('merges both result sets sorted by score', async () => {
      server.use(
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json(fileSearchResponse)),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json(skillSearchResponse)),
      );

      const { result } = renderHook(() => useWorkspaceSearch(WORKSPACE_ID, 'hello'), { wrapper: makeWrapper() });

      await waitFor(() =>
        expect(result.current.data).toEqual([
          {
            kind: 'skill',
            path: 'skills/review/SKILL.md',
            label: 'review',
            score: 0.9,
          },
          { kind: 'file', path: 'README.md', label: 'README.md', score: 0.4 },
        ]),
      );
    });
  });

  describe('when file search is not supported', () => {
    it('keeps the skill results', async () => {
      server.use(
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json({ error: 'unsupported' }, { status: 501 })),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json(skillSearchResponse)),
      );

      const { result } = renderHook(() => useWorkspaceSearch(WORKSPACE_ID, 'hello'), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.data?.map(r => r.kind)).toEqual(['skill']));
    });
  });

  describe('when both searches fail', () => {
    it('reports an error', async () => {
      server.use(
        http.get(`${WORKSPACE_URL}/search`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
        http.get(`${WORKSPACE_URL}/skills/search`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
      );

      const { result } = renderHook(() => useWorkspaceSearch(WORKSPACE_ID, 'hello'), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('when the query is blank', () => {
    it('stays idle', () => {
      const { result } = renderHook(() => useWorkspaceSearch(WORKSPACE_ID, '   '), { wrapper: makeWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
