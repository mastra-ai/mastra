import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { queryKeys } from '../../../../../api/keys';
import { createQueryClient } from '../../../../../query-client';
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

const REPOSITORY_TREE: Record<string, WorkspaceTreeEntry[]> = {
  '': [
    { name: 'docs', path: 'docs', type: 'directory' },
    { name: 'mastra', path: 'mastra', type: 'directory' },
  ],
  docs: [{ name: 'src', path: 'docs/src', type: 'directory' }],
  'docs/src': [{ name: 'agent.ts', path: 'docs/src/agent.ts', type: 'file', size: 9 }],
  mastra: [{ name: 'src', path: 'mastra/src', type: 'directory' }],
  'mastra/src': [{ name: 'agent.ts', path: 'mastra/src/agent.ts', type: 'file', size: 9 }],
};

const REPOSITORY_PATHS = ['mastra/src/agent.ts', 'docs/src/agent.ts'];

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function fileIndex(paths: string[], truncated = false): WorkspaceFileIndex {
  return { workspacePath: WORKSPACE, available: true, paths, truncated };
}

function installHandlers({ index = fileIndex(PATHS), tree = TREE } = {}) {
  const fileRequests: Array<string | null> = [];
  const treeRequests: string[] = [];
  const indexRequests: string[] = [];
  server.use(
    http.get(TREE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path') ?? '';
      treeRequests.push(path);
      return HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries: tree[path] ?? [] });
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
    http.get(FILES_URL, ({ request }) => {
      indexRequests.push(request.url);
      return HttpResponse.json(index);
    }),
    http.get(CHANGES_URL, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, available: true, additions: 0, deletions: 0, changes: [] }),
    ),
  );
  return { fileRequests, treeRequests, indexRequests };
}

async function openFiles(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Changes, 0 files' }));
  await screen.findAllByRole('treeitem');
  return screen.getByRole('combobox', { name: 'Go to file' });
}

async function goToFile(user: UserEvent, query: string) {
  const search = await openFiles(user);
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

  it('says how many files it searched when a partial index has no match', async () => {
    installHandlers({ index: fileIndex(PATHS, true) });
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'zzz');

    expect(
      await screen.findByText("No match for “zzz” among 4 indexed files; the rest of this workspace isn't indexed."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No files match/)).not.toBeInTheDocument();
  });

  it('offers to wake the sandbox instead of saying nothing matches when the index could not be read', async () => {
    installHandlers({ index: { workspacePath: WORKSPACE, available: false, paths: [], truncated: false } });
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');

    expect(await screen.findByRole('button', { name: 'Wake sandbox' })).toBeInTheDocument();
    expect(screen.queryByText(/No files match/)).not.toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('says the search covers only part of the workspace when the index is partial', async () => {
    installHandlers({ index: fileIndex(PATHS, true) });
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');

    expect(await screen.findByText("Searching 4 files; the rest of this workspace isn't indexed.")).toBeInTheDocument();
    expect(foundPaths()).toHaveLength(2);
    expect(screen.queryByText(/Keep typing to narrow/)).not.toBeInTheDocument();
  });

  it('says how many matches are left out, and that the index is partial, when both apply', async () => {
    const many = Array.from({ length: 60 }, (_, i) => `src/module-${String(i).padStart(2, '0')}.ts`);
    installHandlers({ index: fileIndex(many, true) });
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

  it('opens a file from one checkout of a multi-repository session and shows it inside that checkout', async () => {
    const { fileRequests, treeRequests } = installHandlers({
      index: fileIndex(REPOSITORY_PATHS),
      tree: REPOSITORY_TREE,
    });
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    await goToFile(user, 'agent');
    await screen.findByRole('listbox', { name: 'Files found' });
    expect(foundPaths().toSorted()).toEqual(['docs/src/agent.ts', 'mastra/src/agent.ts']);
    await user.click(screen.getByTitle('docs/src/agent.ts'));

    const viewer = await screen.findByLabelText('Workspace file viewer');
    await waitFor(() => expect(viewer).toHaveTextContent('docs/src/agent.ts'));
    expect(fileRequests).toEqual(['docs/src/agent.ts']);

    await user.click(screen.getByRole('button', { name: 'Back to files' }));
    await user.click(screen.getByRole('combobox', { name: 'Go to file' }));
    await user.keyboard('{Escape}');

    expect(await screen.findByRole('treeitem', { name: /agent\.ts/, selected: true })).toBeInTheDocument();
    expect(treeRequests).toContain('docs/src');
    expect(treeRequests).not.toContain('mastra/src');
  });

  it('reads the file index only once the viewer reaches for Go to file', async () => {
    const { indexRequests } = installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />, createQueryClient());

    const search = await openFiles(user);
    expect(indexRequests).toHaveLength(0);

    await user.click(search);
    await waitFor(() => expect(indexRequests).toHaveLength(1));

    await user.keyboard('agent');
    await screen.findByRole('listbox', { name: 'Files found' });
    expect(indexRequests).toHaveLength(1);
  });

  it('says it is still indexing, not that nothing matches, while Refresh reloads the index', async () => {
    const { indexRequests } = installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />, createQueryClient());
    const search = await openFiles(user);
    await user.click(search);
    await waitFor(() => expect(indexRequests).toHaveLength(1));

    let release = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.get(FILES_URL, async () => {
        await held;
        return HttpResponse.json(fileIndex([...PATHS, 'src/new.ts']));
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh workspace files' }));
    await user.click(search);
    await user.keyboard('new');

    expect(await screen.findByRole('status', { name: 'Indexing files' })).toBeInTheDocument();
    expect(screen.queryByText(/No files match/)).not.toBeInTheDocument();

    release();
    await waitFor(() => expect(foundPaths()).toEqual(['src/new.ts']));
  });
});
