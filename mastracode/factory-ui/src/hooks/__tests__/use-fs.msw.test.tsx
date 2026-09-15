import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '../../../e2e/ui/render';
import {
  useArtifactListing,
  useDirectoryListing,
  useWorkspaceChanges,
  useWorkspaceDiff,
  useWorkspaceFile,
  useWorkspaceFiles,
  useWorkspaceRenderedListing,
} from '../use-fs';
import type { WorkspaceChanges, WorkspaceDiff } from '../../api/types';
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
          entries: [
            {
              name: 'HISTORY.md',
              path: 'understand-pr/HISTORY.md',
              type: 'file',
              size: 5,
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
          ],
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useArtifactListing('/home/user/project'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenPath).toBe('/home/user/project');
    expect(result.current.data?.entries[0]?.path).toBe('understand-pr/HISTORY.md');
  });
});

const WORKSPACE_RENDERED_URL = `${TEST_BASE_URL}/web/workspace/rendered/list`;
const WORKSPACE_FILES_URL = `${TEST_BASE_URL}/web/workspace/files`;
const WORKSPACE_FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const THREAD = 'thread-1';

describe('useWorkspaceRenderedListing', () => {
  it('does not fetch until workspace path and root are available', () => {
    let called = false;
    server.use(
      http.get(WORKSPACE_RENDERED_URL, () => {
        called = true;
        return HttpResponse.json({ workspacePath: '', root: '', rootPath: '', entries: [] });
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkspaceRenderedListing(undefined, '.artifacts'));

    expect(result.current.fetchStatus).toBe('idle');
    expect(called).toBe(false);
  });

  it('fetches a configured rendered path for a workspace', async () => {
    let seenWorkspacePath: string | null = null;
    let seenRoot: string | null = null;
    server.use(
      http.get(WORKSPACE_RENDERED_URL, ({ request }) => {
        const url = new global.URL(request.url);
        seenWorkspacePath = url.searchParams.get('workspacePath');
        seenRoot = url.searchParams.get('root');
        return HttpResponse.json({
          workspacePath: '/home/user/project',
          root: '.artifacts',
          rootPath: '/home/user/project/.artifacts',
          entries: [
            {
              name: 'HISTORY.md',
              path: 'understand-pr/HISTORY.md',
              type: 'file',
              size: 5,
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
          ],
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkspaceRenderedListing('/home/user/project', '.artifacts'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenWorkspacePath).toBe('/home/user/project');
    expect(seenRoot).toBe('.artifacts');
    expect(result.current.data?.entries[0]?.path).toBe('understand-pr/HISTORY.md');
  });
});

describe('useWorkspaceFiles', () => {
  describe('when a workspace and thread are available', () => {
    it('requests the persisted file list for that exact scope', async () => {
      let seenWorkspacePath: string | null = null;
      let seenThreadId: string | null = null;
      server.use(
        http.get(WORKSPACE_FILES_URL, ({ request }) => {
          const url = new global.URL(request.url);
          seenWorkspacePath = url.searchParams.get('workspacePath');
          seenThreadId = url.searchParams.get('threadId');
          return HttpResponse.json({
            workspacePath: seenWorkspacePath,
            threadId: seenThreadId,
            files: [{ path: 'src/agent.ts' }],
          });
        }),
      );

      const { result } = renderHookWithProviders(() => useWorkspaceFiles('session-1', THREAD));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(seenWorkspacePath).toBe('session-1');
      expect(seenThreadId).toBe(THREAD);
      expect(result.current.data?.files).toEqual([{ path: 'src/agent.ts' }]);
    });
  });
});

describe('useWorkspaceFile', () => {
  it.each([
    ['disabled', THREAD, { enabled: false }],
    ['without a thread ID', undefined, undefined],
  ])('does not fetch when %s', (_reason, threadId, options) => {
    let called = false;
    server.use(
      http.get(WORKSPACE_FILE_URL, () => {
        called = true;
        return HttpResponse.json({
          workspacePath: '',
          path: '',
          name: '',
          size: 0,
          updatedAt: '',
          contentType: 'text',
          content: '',
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useWorkspaceFile('/home/user/project', '.artifacts/file.md', threadId, options),
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(called).toBe(false);
  });

  it('fetches workspace file content', async () => {
    let seenWorkspacePath: string | null = null;
    let seenPath: string | null = null;
    server.use(
      http.get(WORKSPACE_FILE_URL, ({ request }) => {
        const url = new global.URL(request.url);
        seenWorkspacePath = url.searchParams.get('workspacePath');
        seenPath = url.searchParams.get('path');
        return HttpResponse.json({
          workspacePath: '/home/user/project',
          path: '.artifacts/understand-pr/HISTORY.md',
          name: 'HISTORY.md',
          size: 5,
          updatedAt: '2026-07-15T00:00:00.000Z',
          contentType: 'text',
          content: 'notes',
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useWorkspaceFile('/home/user/project', '.artifacts/understand-pr/HISTORY.md', THREAD),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenWorkspacePath).toBe('/home/user/project');
    expect(seenPath).toBe('.artifacts/understand-pr/HISTORY.md');
    expect(result.current.data?.content).toBe('notes');
  });
});

const WORKSPACE_CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const WORKSPACE_DIFF_URL = `${TEST_BASE_URL}/web/workspace/changes/diff`;

const workspaceChangesFixture = {
  workspacePath: '/home/user/project',
  available: true,
  additions: 8,
  deletions: 1,
  changes: [
    { path: 'src/edited.ts', status: 'modified', additions: 3, deletions: 1 },
    { path: 'src/new.ts', status: 'untracked', additions: 5, deletions: 0 },
  ],
} satisfies WorkspaceChanges;

const workspaceDiffFixture = {
  workspacePath: '/home/user/project',
  path: 'src/edited.ts',
  patch: [
    'diff --git a/src/edited.ts b/src/edited.ts',
    '--- a/src/edited.ts',
    '+++ b/src/edited.ts',
    '@@ -1 +1 @@',
    '-old value',
    '+new value',
  ].join('\n'),
  truncated: false,
} satisfies WorkspaceDiff;

/**
 * `refetch()` on a `skipToken` query is a deliberate no-op, and React Query
 * logs that as an error. Swallow the expected log so the assertion that no
 * request went out doesn't come with misleading test output.
 */
async function withSkippedQueryWarning(run: () => Promise<unknown>) {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
}

describe('useWorkspaceChanges', () => {
  it('does not fetch until a workspace path is available', async () => {
    let called = false;
    server.use(
      http.get(WORKSPACE_CHANGES_URL, () => {
        called = true;
        return HttpResponse.json(workspaceChangesFixture);
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkspaceChanges(undefined));

    expect(result.current.fetchStatus).toBe('idle');
    await withSkippedQueryWarning(() => result.current.refetch());
    expect(called).toBe(false);
  });

  it('fetches changes for the workspace path', async () => {
    let seenWorkspacePath: string | null = null;
    server.use(
      http.get(WORKSPACE_CHANGES_URL, ({ request }) => {
        seenWorkspacePath = new global.URL(request.url).searchParams.get('workspacePath');
        return HttpResponse.json(workspaceChangesFixture);
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkspaceChanges('/home/user/project'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenWorkspacePath).toBe('/home/user/project');
    expect(result.current.data?.changes).toHaveLength(2);
  });
});

describe('useWorkspaceDiff', () => {
  it('does not fetch until both the workspace path and file path are available', async () => {
    let called = false;
    server.use(
      http.get(WORKSPACE_DIFF_URL, () => {
        called = true;
        return HttpResponse.json(workspaceDiffFixture);
      }),
    );

    const { result } = renderHookWithProviders(() => useWorkspaceDiff('/home/user/project', undefined));

    expect(result.current.fetchStatus).toBe('idle');
    await withSkippedQueryWarning(() => result.current.refetch());
    expect(called).toBe(false);
  });

  it('fetches the diff and forwards a rename source path', async () => {
    let seenPath: string | null = null;
    let seenPreviousPath: string | null = null;
    server.use(
      http.get(WORKSPACE_DIFF_URL, ({ request }) => {
        const url = new global.URL(request.url);
        seenPath = url.searchParams.get('path');
        seenPreviousPath = url.searchParams.get('previousPath');
        return HttpResponse.json(workspaceDiffFixture);
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useWorkspaceDiff('/home/user/project', 'src/edited.ts', 'src/old name.ts'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenPath).toBe('src/edited.ts');
    expect(seenPreviousPath).toBe('src/old name.ts');
    expect(result.current.data?.patch).toContain('+new value');
  });
});
