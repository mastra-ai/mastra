import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderHookWithProviders } from '../../../../e2e/web-ui/render';
import {
  useArtifactListing,
  useDirectoryListing,
  useWorkspaceFile,
  useWorkspacePlan,
  useWorkspaceRenderedListing,
} from '../use-fs';
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
const WORKSPACE_FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const WORKSPACE_PLAN_URL = `${TEST_BASE_URL}/web/workspace/plan`;

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

describe('useWorkspaceFile', () => {
  it('does not fetch when disabled', () => {
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
      useWorkspaceFile('/home/user/project', '.artifacts/file.md', { enabled: false }),
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
      useWorkspaceFile('/home/user/project', '.artifacts/understand-pr/HISTORY.md'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenWorkspacePath).toBe('/home/user/project');
    expect(seenPath).toBe('.artifacts/understand-pr/HISTORY.md');
    expect(result.current.data?.content).toBe('notes');
  });
});

describe('useWorkspacePlan', () => {
  it('does not fetch until a workspace path and plan path are available', () => {
    let called = false;
    server.use(
      http.get(WORKSPACE_PLAN_URL, () => {
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

    const { result } = renderHookWithProviders(() => useWorkspacePlan(undefined, '.mastracode/plans/add-readme.md'));

    expect(result.current.fetchStatus).toBe('idle');
    expect(called).toBe(false);
  });

  it('fetches the plan markdown content for the session workspace', async () => {
    let seenWorkspacePath: string | null = null;
    let seenPath: string | null = null;
    server.use(
      http.get(WORKSPACE_PLAN_URL, ({ request }) => {
        const url = new global.URL(request.url);
        seenWorkspacePath = url.searchParams.get('workspacePath');
        seenPath = url.searchParams.get('path');
        return HttpResponse.json({
          workspacePath: 'session-123',
          path: '.mastracode/plans/add-readme.md',
          name: 'add-readme.md',
          size: 6,
          updatedAt: '2026-07-15T00:00:00.000Z',
          contentType: 'text',
          content: '# Plan',
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useWorkspacePlan('session-123', '.mastracode/plans/add-readme.md'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenWorkspacePath).toBe('session-123');
    expect(seenPath).toBe('.mastracode/plans/add-readme.md');
    expect(result.current.data?.content).toBe('# Plan');
  });
});
