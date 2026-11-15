import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import type { WorkspaceFileIndex, WorkspaceTreeEntry } from '../../../../../api/types';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

const TREE_URL = `${TEST_BASE_URL}/web/workspace/tree`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const FILES_URL = `${TEST_BASE_URL}/web/workspace/files`;
const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const WORKSPACE = 'session-1';

const TREE: Record<string, WorkspaceTreeEntry[]> = {
  '': [
    { name: '.github', path: '.github', type: 'directory' },
    { name: 'src', path: 'src', type: 'directory' },
    { name: 'README.md', path: 'README.md', type: 'file', size: 9 },
  ],
  '.github': [{ name: 'workflows', path: '.github/workflows', type: 'directory' }],
  '.github/workflows': [{ name: 'ci.yml', path: '.github/workflows/ci.yml', type: 'file', size: 9 }],
  src: [
    { name: 'agent.ts', path: 'src/agent.ts', type: 'file', size: 9 },
    { name: 'agent.test.ts', path: 'src/agent.test.ts', type: 'file', size: 9 },
  ],
};

const PATHS = ['.github/workflows/ci.yml', 'README.md', 'src/agent.test.ts', 'src/agent.ts'];

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function fileIndex(paths: string[], truncated = false): WorkspaceFileIndex {
  return { workspacePath: WORKSPACE, available: true, paths, truncated };
}

function installHandlers(index: WorkspaceFileIndex = fileIndex(PATHS)) {
  const fileRequests: Array<string | null> = [];
  const treeRequests: string[] = [];
  server.use(
    http.get(TREE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path') ?? '';
      treeRequests.push(path);
      return HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries: TREE[path] ?? [] });
    }),
    http.get(FILE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path');
      fileRequests.push(path);
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        path,
        name: path?.split('/').pop() ?? 'file',
        size: 9,
        updatedAt: '2026-08-07T00:00:00.000Z',
        contentType: 'text',
        content: `${path}\n`,
      });
    }),
    http.get(FILES_URL, () => HttpResponse.json(index)),
    http.get(CHANGES_URL, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, available: true, additions: 0, deletions: 0, changes: [] }),
    ),
  );
  return { fileRequests, treeRequests };
}

async function goToFile(user: UserEvent, query: string) {
  await user.click(await screen.findByRole('button', { name: 'Changes, 0 files' }));
  await screen.findByText('README.md');
  const search = screen.getByRole('combobox', { name: 'Go to file' });
  await user.click(search);
  await user.keyboard(query);
  return search;
}

const foundPaths = () => screen.getAllByRole('option').map(option => option.getAttribute('title'));

describe('Go to file', () => {
  it('moves through the matches with the arrow keys and opens the chosen one with Enter', async () => {
    const { fileRequests } = installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');

    const results = await screen.findByRole('listbox', { name: 'Files found' });
    const options = within(results).getAllByRole('option');
    expect(foundPaths().toSorted()).toEqual(['src/agent.test.ts', 'src/agent.ts']);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');

    const chosen = options[1]?.getAttribute('title');
    await user.keyboard('{Enter}');

    const viewer = await screen.findByLabelText('Workspace file viewer');
    await waitFor(() => expect(viewer).toHaveTextContent(`${chosen}`));
    expect(fileRequests).toEqual([chosen]);
  });

  it('clears the search with Escape and shows the tree again', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    const search = await goToFile(user, 'agent');
    await screen.findByRole('listbox', { name: 'Files found' });

    await user.keyboard('{Escape}');

    expect(search).toHaveValue('');
    expect(screen.queryByRole('listbox', { name: 'Files found' })).not.toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('opens a file inside a hidden folder where the tree can show it', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'ci.yml');
    await screen.findByRole('listbox', { name: 'Files found' });
    await user.keyboard('{Enter}');
    await screen.findByLabelText('Workspace file viewer');

    await user.click(screen.getByRole('button', { name: 'Back to files' }));
    await user.click(screen.getByRole('combobox', { name: 'Go to file' }));
    await user.keyboard('{Escape}');

    expect(await screen.findByText('ci.yml')).toBeInTheDocument();
    expect(screen.getByText('.github')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide hidden files' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('says when no file matches', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'zzz');

    expect(await screen.findByText('No files match “zzz”')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('says the search covers only part of the workspace when the index is partial', async () => {
    installHandlers(fileIndex(PATHS, true));
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');

    expect(await screen.findByText("Searching 4 files; the rest of this workspace isn't indexed.")).toBeInTheDocument();
    expect(foundPaths()).toHaveLength(2);
    expect(screen.queryByText(/Keep typing to narrow/)).not.toBeInTheDocument();
  });

  it('says how many matches are left out, and that the index is partial, when both apply', async () => {
    const many = Array.from({ length: 60 }, (_, i) => `src/module-${String(i).padStart(2, '0')}.ts`);
    installHandlers(fileIndex(many, true));
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'module');

    const notice = await screen.findByText(/Showing 50 of 60\. Keep typing to narrow\./);
    expect(notice).toHaveTextContent("Searching 60 files; the rest of this workspace isn't indexed.");
    expect(foundPaths()).toHaveLength(50);
  });

  it('shows why the files could not be indexed', async () => {
    installHandlers();
    server.use(
      http.get(FILES_URL, () => HttpResponse.json({ error: 'Unable to list files: git failed' }, { status: 500 })),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');

    expect(await screen.findByText('Unable to list files: git failed')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('keeps Refresh spinning until the shown matches are refreshed too', async () => {
    const { treeRequests } = installHandlers();
    let release = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    let holding = false;
    let heldRequests = 0;
    server.use(
      http.get(FILES_URL, async () => {
        if (holding) {
          heldRequests += 1;
          await held;
        }
        return HttpResponse.json(fileIndex(PATHS));
      }),
    );
    const user = userEvent.setup();
    const { client } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');
    await screen.findByRole('listbox', { name: 'Files found' });
    const refresh = await screen.findByRole('button', { name: 'Refresh workspace files' });
    const treeReads = treeRequests.length;
    holding = true;
    await user.click(refresh);

    await waitFor(() => expect(client.getQueryState(queryKeys.workspaceTree(WORKSPACE, ''))?.dataUpdateCount).toBe(2));
    expect(treeRequests).toHaveLength(treeReads + 1);
    expect(heldRequests).toBe(1);
    expect(screen.getByRole('button', { name: 'Refreshing workspace files' })).toBeDisabled();

    release();
    expect(await screen.findByRole('button', { name: 'Refresh workspace files' })).toBeEnabled();
  });
});
