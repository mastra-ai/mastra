import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';
import {
  htmlFile,
  markdownFile,
  typescriptFile,
  unknownLanguageFile,
  unsupportedFile,
} from './fixtures/workspace-file';

const TREE_URL = `${TEST_BASE_URL}/web/workspace/tree`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const DIFF_URL = `${TEST_BASE_URL}/web/workspace/changes/diff`;
const WORKSPACE = 'session-1';

const TREE: Record<string, Array<{ name: string; path: string; type: 'file' | 'directory'; size?: number }>> = {
  '': [
    { name: 'src', path: 'src', type: 'directory' },
    { name: 'README.md', path: 'README.md', type: 'file', size: 9 },
  ],
  src: [{ name: 'agent.ts', path: 'src/agent.ts', type: 'file', size: 13 }],
};

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function installHandlers() {
  const fileRequests: Array<string | null> = [];
  const treeRequests: string[] = [];
  server.use(
    http.get(TREE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path') ?? '';
      treeRequests.push(path);
      return HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries: TREE[path] ?? [] });
    }),
    http.get(FILE_URL, ({ request }) => {
      const url = new URL(request.url);
      const path = url.searchParams.get('path');
      fileRequests.push(path);
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        path,
        name: path?.split('/').pop() ?? 'file.ts',
        size: 13,
        updatedAt: '2026-08-07T00:00:00.000Z',
        contentType: 'text',
        content: 'export {}\n',
      });
    }),
    http.get(CHANGES_URL, () =>
      HttpResponse.json({ workspacePath: WORKSPACE, available: true, additions: 0, deletions: 0, changes: [] }),
    ),
  );
  return Object.assign(fileRequests, { treeRequests });
}

/** A tree holding just one file, at any depth. */
function treeHolding(filePath: string) {
  return http.get(TREE_URL, ({ request }) => {
    const path = new URL(request.url).searchParams.get('path') ?? '';
    const rest = (path ? filePath.slice(path.length + 1) : filePath).split('/');
    const name = rest[0];
    const entryPath = path ? `${path}/${name}` : name;
    const inside = path === '' || filePath.startsWith(`${path}/`);
    return HttpResponse.json({
      workspacePath: WORKSPACE,
      path,
      available: true,
      entries: inside ? [{ name, path: entryPath, type: rest.length > 1 ? 'directory' : 'file' }] : [],
    });
  });
}

function pendingChangesHandler() {
  return http.get(CHANGES_URL, () =>
    HttpResponse.json({
      workspacePath: WORKSPACE,
      available: true,
      additions: 4,
      deletions: 1,
      changes: [{ path: 'src/agent.ts', status: 'modified', additions: 4, deletions: 1 }],
    }),
  );
}

describe('WorkspaceViewerPanel', () => {
  describe('when a file preview needs syntax highlighting', () => {
    it.each([typescriptFile, htmlFile])('renders $path as safe text and then adds dual-theme colors', async file => {
      installHandlers();
      server.use(
        treeHolding(file.path),
        http.get(FILE_URL, () => HttpResponse.json(file)),
      );
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /Files/ }));
      if (file.path.startsWith('src/')) await user.click(await screen.findByRole('button', { name: 'src' }));
      await user.click(await screen.findByText(file.name));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      await waitFor(() => expect(viewer.querySelector('pre')?.textContent).toBe(file.content));
      expect(viewer.querySelector('script')).toBeNull();
      await waitFor(() => {
        const coloredToken = viewer.querySelector<HTMLElement>('pre span[style]');
        expect(coloredToken?.style.getPropertyValue('--shiki-light')).toMatch(/^#/);
        expect(coloredToken?.style.getPropertyValue('--shiki-dark')).toMatch(/^#/);
      });
      expect(viewer.querySelector('pre')?.textContent).toBe(file.content);
      expect(viewer.querySelector('script')).toBeNull();
    });

    it('shows unknown languages as literal plain text', async () => {
      installHandlers();
      server.use(
        treeHolding(unknownLanguageFile.path),
        http.get(FILE_URL, () => HttpResponse.json(unknownLanguageFile)),
      );
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /Files/ }));
      await user.click(await screen.findByText(unknownLanguageFile.name));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      await waitFor(() => expect(viewer.querySelector('pre')?.textContent).toBe(unknownLanguageFile.content));
      expect(viewer.querySelector('script')).toBeNull();
      expect(viewer.querySelector('pre span[style]')).toBeNull();
    });

    it('still renders markdown as a document', async () => {
      installHandlers();
      server.use(http.get(FILE_URL, () => HttpResponse.json(markdownFile)));
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /Files/ }));
      await user.click(await screen.findByText('README.md'));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      expect(await within(viewer).findByRole('heading', { name: 'Workspace notes' })).toBeInTheDocument();
      expect(viewer.querySelector('pre')).toBeNull();
    });

    it('keeps unsupported files out of the code renderer', async () => {
      installHandlers();
      server.use(
        treeHolding(unsupportedFile.path),
        http.get(FILE_URL, () => HttpResponse.json(unsupportedFile)),
      );
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /Files/ }));
      await user.click(await screen.findByText(unsupportedFile.name));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      expect(await within(viewer).findByText('This file type cannot be previewed as text.')).toBeInTheDocument();
      expect(viewer.querySelector('pre')).toBeNull();
    });
  });

  describe('when browsing the session files', () => {
    it('reads nothing from the sandbox until the files view opens, then one folder at a time', async () => {
      const { treeRequests } = installHandlers();
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await screen.findByRole('button', { name: /^Changes/ });
      expect(treeRequests).toEqual([]);

      await user.click(screen.getByRole('button', { name: /^Files/ }));
      expect(await screen.findByText('README.md')).toBeInTheDocument();
      expect(screen.queryByText('agent.ts')).not.toBeInTheDocument();
      expect(treeRequests).toEqual(['']);

      await user.click(screen.getByRole('button', { name: 'src' }));
      expect(await screen.findByText('agent.ts')).toBeInTheDocument();
      expect(treeRequests).toEqual(['', 'src']);
    });

    it('hides dotfiles and dot-folders until the eye toggle shows them, even after opening a file', async () => {
      installHandlers();
      server.use(
        http.get(TREE_URL, ({ request }) => {
          const path = new URL(request.url).searchParams.get('path') ?? '';
          const entries =
            path === ''
              ? [
                  { name: '.github', path: '.github', type: 'directory' },
                  { name: '.env.example', path: '.env.example', type: 'file' },
                  { name: 'README.md', path: 'README.md', type: 'file' },
                ]
              : [];
          return HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries });
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));
      await screen.findByText('README.md');
      expect(screen.queryByText('.github')).not.toBeInTheDocument();
      expect(screen.queryByText('.env.example')).not.toBeInTheDocument();

      await user.hover(screen.getByRole('button', { name: 'Show hidden files' }));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Show hidden files');

      await user.click(screen.getByRole('button', { name: 'Show hidden files' }));
      expect(screen.getByText('.github')).toBeInTheDocument();
      expect(screen.getByText('.env.example')).toBeInTheDocument();

      await user.click(screen.getByText('README.md'));
      await user.click(await screen.findByRole('button', { name: 'Back to workspace files' }));
      expect(await screen.findByText('.github')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Hide hidden files' }));
      expect(screen.queryByText('.github')).not.toBeInTheDocument();
    });

    it('refetches every open folder on refresh', async () => {
      const { treeRequests } = installHandlers();
      const user = userEvent.setup();
      const { client } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));
      await user.click(await screen.findByRole('button', { name: 'src' }));
      await screen.findByText('agent.ts');

      await user.click(screen.getByRole('button', { name: 'Refresh workspace files' }));

      await waitFor(() => expect(treeRequests.toSorted()).toEqual(['', '', 'src', 'src']));
      await waitForMutationsIdle(client);
    });

    it('refreshes the selected file and preserves the expanded folder', async () => {
      const fileRequests = installHandlers();
      const user = userEvent.setup();
      const { client } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));

      await user.click(await screen.findByRole('button', { name: 'src' }));
      await user.click(await screen.findByText('agent.ts'));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      expect(viewer).toHaveTextContent('export {}');
      expect([...fileRequests]).toEqual(['src/agent.ts']);

      await user.click(screen.getByRole('button', { name: 'Refresh file' }));
      await waitFor(() => expect(fileRequests).toHaveLength(2));
      await waitForMutationsIdle(client);
      await user.click(screen.getByRole('button', { name: 'Back to workspace files' }));

      expect(screen.getByRole('button', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('agent.ts')).toBeInTheDocument();
    });

    it('says the sandbox is not running instead of starting it', async () => {
      installHandlers();
      server.use(
        http.get(TREE_URL, () =>
          HttpResponse.json({ workspacePath: WORKSPACE, path: '', available: false, entries: [] }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));

      expect(await screen.findByText(/The sandbox isn.t running/)).toBeInTheDocument();
    });

    it('shows a folder the server refuses as an error inside that folder', async () => {
      installHandlers();
      server.use(
        http.get(TREE_URL, ({ request }) => {
          const path = new URL(request.url).searchParams.get('path') ?? '';
          return path === 'src'
            ? HttpResponse.json({ error: 'Path is not available in this session' }, { status: 403 })
            : HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries: TREE[path] ?? [] });
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));
      await user.click(await screen.findByRole('button', { name: 'src' }));

      expect(await screen.findByText(/not available in this session/)).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });
  });

  describe('when the workspace has pending changes', () => {
    it('opens the changes and diff inside the same panel', async () => {
      installHandlers();
      server.use(
        pendingChangesHandler(),
        http.get(DIFF_URL, ({ request }) => {
          const path = new URL(request.url).searchParams.get('path');
          return HttpResponse.json({
            workspacePath: WORKSPACE,
            path,
            patch:
              'diff --git a/src/agent.ts b/src/agent.ts\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/src/agent.ts\n@@ -1 +1 @@\n-export {}\n+export const agent = {};\n',
            truncated: false,
          });
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

      await screen.findByText('+4');
      const changesButton = screen.getByRole('button', { name: /Changes/ });
      expect(changesButton).toHaveTextContent('−1');
      await user.click(changesButton);
      await user.click(await screen.findByText('agent.ts'));

      const changesPanel = await screen.findByTestId('workspace-changes-panel');
      const diff = await within(changesPanel).findByLabelText('Workspace change diff');
      await waitFor(() =>
        expect(diff.querySelector('diffs-container')?.shadowRoot?.textContent).toContain('export const agent = {};'),
      );
      expect(within(changesPanel).queryByText('new file mode 100644')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Back to changed files' }));
      const selectedChange = screen
        .getByTestId('workspace-changes-panel')
        .querySelector<HTMLElement>('[data-tree-item-id="src/agent.ts"]');
      expect(selectedChange).toHaveAttribute('aria-selected', 'true');
    });

    it('returns to the changes list when the selected change disappears', async () => {
      installHandlers();
      server.use(
        pendingChangesHandler(),
        http.get(DIFF_URL, ({ request }) => {
          const path = new URL(request.url).searchParams.get('path');
          return HttpResponse.json({
            workspacePath: WORKSPACE,
            path,
            patch:
              'diff --git a/src/agent.ts b/src/agent.ts\nindex 1234567..abcdef0 100644\n--- a/src/agent.ts\n+++ b/src/agent.ts\n@@ -1 +1 @@\n-export {}\n+export const agent = {};\n',
            truncated: false,
          });
        }),
      );
      const user = userEvent.setup();
      const { client } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

      await user.click(await screen.findByRole('button', { name: /Changes/ }));
      await user.click(await screen.findByText('agent.ts'));
      await screen.findByLabelText('Workspace change diff');

      act(() => {
        client.setQueryData(queryKeys.workspaceChanges(WORKSPACE), {
          workspacePath: WORKSPACE,
          available: true,
          additions: 0,
          deletions: 0,
          changes: [],
        });
      });

      expect(await screen.findByRole('heading', { name: 'Changes' })).toBeInTheDocument();
      expect(screen.getByText('No changes')).toBeInTheDocument();
      expect(screen.queryByLabelText('Workspace change diff')).not.toBeInTheDocument();
    });
    it('does not present cached change totals after a refresh fails', async () => {
      installHandlers();
      server.use(pendingChangesHandler());
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      const changesButton = await screen.findByRole('button', { name: /Changes/ });
      await screen.findByText('+4');
      await user.click(changesButton);

      server.use(http.get(CHANGES_URL, () => HttpResponse.json({ error: 'Unable to read changes' }, { status: 500 })));
      await user.click(screen.getByRole('button', { name: 'Refresh changes' }));
      await screen.findByText('Unable to read changes');
      await user.click(screen.getByRole('button', { name: 'Back to workspace' }));

      expect(await screen.findByText('Unavailable')).toBeInTheDocument();
      expect(screen.queryByText('+4')).not.toBeInTheDocument();
    });
  });

  describe('when the session sandbox is not running', () => {
    it('reports the sandbox state instead of pretending changes are pending', async () => {
      installHandlers();
      // Changes are the live-VM-backed surface: the server reports
      // `available: false` when no session sandbox is running (nothing is
      // ever provisioned by browsing).
      server.use(
        http.get(CHANGES_URL, () => HttpResponse.json({ workspacePath: WORKSPACE, available: false, changes: [] })),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

      const changesButton = screen.getByRole('button', { name: /^Changes/ });
      await within(changesButton).findByText('No sandbox');
      await user.click(changesButton);

      expect(
        await screen.findByText('No sandbox running. Changes appear once the session sandbox starts.'),
      ).toBeInTheDocument();
    });
  });
});
