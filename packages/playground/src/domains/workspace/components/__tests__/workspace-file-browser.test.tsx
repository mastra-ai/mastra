// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw-server';
import { WorkspaceFileBrowser } from '../workspace-file-browser';
import { rootListing, rootListingWithSkill, srcListing } from './fixtures/workspace-files';

const BASE_URL = 'http://localhost:4111';
const WORKSPACE_ID = 'ws-1';

const renderBrowser = (props: Partial<React.ComponentProps<typeof WorkspaceFileBrowser>> = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (extraProps: Partial<React.ComponentProps<typeof WorkspaceFileBrowser>>) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <WorkspaceFileBrowser
            workspaceId={WORKSPACE_ID}
            onFileSelect={() => undefined}
            {...extraProps}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
  const result = render(tree(props));
  return {
    ...result,
    rerenderBrowser: (extraProps: Partial<React.ComponentProps<typeof WorkspaceFileBrowser>>) =>
      result.rerender(tree(extraProps)),
  };
};

const getTreeItemById = (id: string) => {
  const el = document.querySelector(`[data-tree-item-id="${id}"]`);
  if (!el) throw new Error(`tree item ${id} not found`);
  return el as HTMLElement;
};

const getFolderTrigger = (id: string) => {
  const trigger = getTreeItemById(id).querySelector('[data-tree-folder-trigger="true"]');
  if (!trigger) throw new Error(`folder trigger ${id} not found`);
  return trigger as HTMLElement;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('WorkspaceFileBrowser', () => {
  it('loads only the root listing initially and does not eagerly fetch folder children', async () => {
    const onListFiles = vi.fn<(path: string | null, recursive: string | null) => void>();
    server.use(
      http.get(`${BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/list`, ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get('path');
        onListFiles(path, url.searchParams.get('recursive'));
        return HttpResponse.json(path === 'src' ? srcListing : rootListing);
      }),
    );

    renderBrowser();

    expect(await screen.findByText('src')).not.toBeNull();
    expect(screen.queryByText('index.ts')).toBeNull();

    // Only the root was requested, and it was requested non-recursively.
    expect(onListFiles).toHaveBeenCalledTimes(1);
    expect(onListFiles).toHaveBeenCalledWith('.', 'false');
  });

  it('lazily fetches and renders a folder\'s children when it is expanded', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/list`, ({ request }) => {
        const path = new URL(request.url).searchParams.get('path');
        return HttpResponse.json(path === 'src' ? srcListing : rootListing);
      }),
    );

    renderBrowser();

    const srcItem = await screen.findByText('src');
    expect(screen.queryByText('index.ts')).toBeNull();

    fireEvent.click(getFolderTrigger('src'));

    // Children appear after the lazy fetch resolves, with full paths preserved.
    expect(await screen.findByText('index.ts')).not.toBeNull();
    expect(getTreeItemById('src/index.ts')).not.toBeNull();
    expect(getTreeItemById('src/components')).not.toBeNull();
    expect(srcItem).not.toBeNull();
  });

  it('reloads the root listing when refreshToken changes', async () => {
    // Root starts without the skills folder, then a "skill install" adds it.
    let installed = false;
    server.use(
      http.get(`${BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/list`, ({ request }) => {
        const path = new URL(request.url).searchParams.get('path');
        if (path === 'src') return HttpResponse.json(srcListing);
        return HttpResponse.json(installed ? rootListingWithSkill : rootListing);
      }),
    );

    const { rerenderBrowser } = renderBrowser({ refreshToken: 0 });

    await screen.findByText('src');
    expect(screen.queryByText('.agents')).toBeNull();

    // Simulate the skill being installed, then bump the token to force a reload.
    installed = true;
    rerenderBrowser({ refreshToken: 1 });

    expect(await screen.findByText('.agents')).not.toBeNull();
  });

  it('does not re-fetch a folder that has already been loaded', async () => {
    const onListFiles = vi.fn<(path: string | null) => void>();
    server.use(
      http.get(`${BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/list`, ({ request }) => {
        const path = new URL(request.url).searchParams.get('path');
        onListFiles(path);
        return HttpResponse.json(path === 'src' ? srcListing : rootListing);
      }),
    );

    renderBrowser();
    await screen.findByText('src');

    fireEvent.click(getFolderTrigger('src'));
    await screen.findByText('index.ts');

    // Collapse then re-expand — children are cached, so no second request.
    fireEvent.click(getFolderTrigger('src'));
    fireEvent.click(getFolderTrigger('src'));

    await waitFor(() => expect(onListFiles).toHaveBeenCalledWith('src'));
    const srcFetches = onListFiles.mock.calls.filter(([path]) => path === 'src');
    expect(srcFetches).toHaveLength(1);
  });
});
