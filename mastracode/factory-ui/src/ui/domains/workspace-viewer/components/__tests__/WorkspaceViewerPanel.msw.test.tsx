import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { WorkspaceChangePatches, WorkspaceChangesScope } from '../../../../../api/types';
import { server } from '../../../../../../e2e/ui/msw-server';
import { openPropertiesMenu, openPropertySubmenu } from '../../../../../../e2e/ui/properties-menu';
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
const PATCHES_URL = `${TEST_BASE_URL}/web/workspace/changes/patches`;
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
    http.get(PATCHES_URL, () =>
      HttpResponse.json({
        workspacePath: WORKSPACE,
        available: true,
        additions: 0,
        deletions: 0,
        changes: [],
        scope: 'branch',
        patches: {},
        omittedPatches: {},
      }),
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

const AGENT_CHANGE = { path: 'src/agent.ts', status: 'modified', additions: 4, deletions: 1 } as const;
const AGENT_PATCH =
  'diff --git a/src/agent.ts b/src/agent.ts\nindex 1234567..abcdef0 100644\n--- a/src/agent.ts\n+++ b/src/agent.ts\n@@ -1 +1 @@\n-export {}\n+export const agent = {};\n';

function pendingChangesHandler() {
  return http.get(CHANGES_URL, () =>
    HttpResponse.json({
      workspacePath: WORKSPACE,
      available: true,
      additions: 4,
      deletions: 1,
      changes: [AGENT_CHANGE],
    }),
  );
}

type ScopedChanges = Pick<WorkspaceChangePatches, 'changes' | 'patches'> &
  Partial<Pick<WorkspaceChangePatches, 'omittedPatches'>>;

/** Answers the Changes panel with the files and diffs of the scope it asks for. */
function patchesHandler(byScope: Record<WorkspaceChangesScope, ScopedChanges>) {
  return http.get(PATCHES_URL, ({ request }) => {
    const scope = new URL(request.url).searchParams.get('scope') === 'uncommitted' ? 'uncommitted' : 'branch';
    const { changes, patches, omittedPatches = {} } = byScope[scope];
    return HttpResponse.json({
      workspacePath: WORKSPACE,
      available: true,
      additions: changes.reduce((sum, change) => sum + (change.additions ?? 0), 0),
      deletions: changes.reduce((sum, change) => sum + (change.deletions ?? 0), 0),
      changes,
      scope,
      patches,
      omittedPatches,
    } satisfies WorkspaceChangePatches);
  });
}

function diffText(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll('diffs-container'),
    container => container.shadowRoot?.textContent ?? '',
  ).join('\n');
}

function diffLayoutOf(panel: HTMLElement) {
  return panel
    .querySelector('diffs-container')
    ?.shadowRoot?.querySelector('pre[data-diff-type]')
    ?.getAttribute('data-diff-type');
}

describe('WorkspaceViewerPanel', () => {
  describe('when a file preview needs syntax highlighting', () => {
    it.each([typescriptFile, htmlFile])('renders $path as safe text and then colors its tokens', async file => {
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
      // Tokens carry `syntax-*` role classes; colors come from theme CSS, not inline styles.
      await waitFor(() => expect(viewer.querySelector('pre span[class^="syntax-"]')).not.toBeNull());
      expect(viewer.querySelector('pre span[style]')).toBeNull();
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

    it('shows where symlinks point and opens a linked folder at its target', async () => {
      installHandlers();
      const requested: string[] = [];
      server.use(
        http.get(TREE_URL, ({ request }) => {
          const path = new URL(request.url).searchParams.get('path') ?? '';
          requested.push(path);
          const listings: Record<string, object[]> = {
            '': [
              {
                name: 'docs',
                path: 'docs',
                type: 'directory',
                symlinkTarget: 'packages/docs',
                linkedPath: 'packages/docs',
              },
              { name: 'packages', path: 'packages', type: 'directory' },
              {
                name: 'CLAUDE.md',
                path: 'CLAUDE.md',
                type: 'file',
                symlinkTarget: 'AGENTS.md',
                linkedPath: 'AGENTS.md',
              },
            ],
            packages: [{ name: 'docs', path: 'packages/docs', type: 'directory' }],
            'packages/docs': [{ name: 'guide.md', path: 'packages/docs/guide.md', type: 'file' }],
          };
          return HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries: listings[path] ?? [] });
        }),
      );
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));

      expect(await screen.findByText('→ AGENTS.md')).toBeInTheDocument();
      expect(screen.getByText('→ packages/docs')).toBeInTheDocument();

      await user.click(screen.getByText('docs'));
      expect(await screen.findByText('guide.md')).toBeInTheDocument();
      expect(requested).toEqual(['', 'packages', 'packages/docs']);
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

    it('starts the sandbox only when asked, then lists its files', async () => {
      installHandlers();
      let running = false;
      const starts: string[] = [];
      server.use(
        http.get(TREE_URL, () =>
          HttpResponse.json(
            running
              ? {
                  workspacePath: WORKSPACE,
                  path: '',
                  available: true,
                  entries: [{ name: 'README.md', path: 'README.md', type: 'file' }],
                }
              : { workspacePath: WORKSPACE, path: '', available: false, entries: [] },
          ),
        ),
        http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/sandbox/start`, ({ params }) => {
          starts.push(String(params.sessionId));
          running = true;
          return HttpResponse.json({ started: true });
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));

      expect(await screen.findByText(/The sandbox isn.t running/)).toBeInTheDocument();
      expect(starts).toEqual([]);

      await user.click(screen.getByRole('button', { name: 'Wake sandbox' }));

      expect(await screen.findByText('README.md')).toBeInTheDocument();
      expect(starts).toEqual([WORKSPACE]);
    });

    it('shows why the sandbox could not start', async () => {
      installHandlers();
      server.use(
        http.get(TREE_URL, () =>
          HttpResponse.json({ workspacePath: WORKSPACE, path: '', available: false, entries: [] }),
        ),
        http.post(`${TEST_BASE_URL}/web/user-sessions/:sessionId/sandbox/start`, () =>
          HttpResponse.json({ error: 'setup failed' }, { status: 500 }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /^Files/ }));
      await user.click(await screen.findByRole('button', { name: 'Wake sandbox' }));

      expect(await screen.findByText('setup failed')).toBeInTheDocument();
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
    it('stacks the diff of every changed file and says why a file has none', async () => {
      installHandlers();
      const generated = { path: 'src/generated.json', status: 'untracked', additions: 90_000, deletions: 0 } as const;
      const vendored = { path: 'vendor/bundle.js', status: 'untracked', additions: 12, deletions: 0 } as const;
      const conflicted = { path: 'src/merge.ts', status: 'conflicted' } as const;
      server.use(
        pendingChangesHandler(),
        patchesHandler({
          branch: {
            changes: [AGENT_CHANGE, generated, vendored, conflicted],
            patches: { [AGENT_CHANGE.path]: AGENT_PATCH },
            omittedPatches: { [generated.path]: 'file-too-large', [vendored.path]: 'total-too-large' },
          },
          uncommitted: { changes: [], patches: {} },
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

      await screen.findByText('+4');
      const changesButton = screen.getByRole('button', { name: /Changes/ });
      expect(changesButton).toHaveTextContent('−1');
      await user.click(changesButton);

      const changesPanel = await screen.findByTestId('workspace-changes-panel');
      await waitFor(() => expect(diffText(changesPanel)).toContain('export const agent = {};'));
      expect(within(changesPanel).getByText('Diff too large to show')).toBeInTheDocument();
      expect(within(changesPanel).getByText('Too many changes to show')).toBeInTheDocument();
      expect(within(changesPanel).getByText('Diff unavailable')).toBeInTheDocument();
      expect(within(changesPanel).getByRole('button', { name: 'Jump to file, 4 files' })).toBeInTheDocument();
    });

    it('shows a moved file with where it came from instead of an empty diff', async () => {
      installHandlers();
      const moved = {
        path: 'src/agents/helper.ts',
        previousPath: 'src/helper.ts',
        status: 'renamed',
        additions: 0,
        deletions: 0,
      } as const;
      const movedPatch =
        'diff --git a/src/helper.ts b/src/agents/helper.ts\nsimilarity index 100%\nrename from src/helper.ts\nrename to src/agents/helper.ts\n';
      server.use(
        pendingChangesHandler(),
        patchesHandler({
          branch: {
            changes: [AGENT_CHANGE, moved],
            patches: { [AGENT_CHANGE.path]: AGENT_PATCH, [moved.path]: movedPatch },
          },
          uncommitted: { changes: [], patches: {} },
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /Changes/ }));
      const changesPanel = await screen.findByTestId('workspace-changes-panel');

      expect((await within(changesPanel).findByText('from')).parentElement).toHaveTextContent('from src/helper.ts');
      expect(within(changesPanel).getByRole('img', { name: 'Renamed' })).toBeInTheDocument();
      expect(within(changesPanel).queryByText('+0')).not.toBeInTheDocument();
      expect(within(changesPanel).queryByRole('button', { name: /helper\.ts/ })).not.toBeInTheDocument();
      await waitFor(() => expect(changesPanel.querySelectorAll('diffs-container')).toHaveLength(1));
    });

    it('shows only uncommitted work once switched away from the whole branch', async () => {
      installHandlers();
      const notes = { path: 'NOTES.md', status: 'untracked', additions: 1, deletions: 0 } as const;
      const notesPatch =
        'diff --git a/NOTES.md b/NOTES.md\nnew file mode 100644\nindex 0000000..1111111\n--- /dev/null\n+++ b/NOTES.md\n@@ -0,0 +1 @@\n+draft notes\n';
      server.use(
        pendingChangesHandler(),
        patchesHandler({
          branch: {
            changes: [AGENT_CHANGE, notes],
            patches: { [AGENT_CHANGE.path]: AGENT_PATCH, [notes.path]: notesPatch },
          },
          uncommitted: { changes: [notes], patches: { [notes.path]: notesPatch } },
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      await user.click(await screen.findByRole('button', { name: /Changes/ }));
      const changesPanel = await screen.findByTestId('workspace-changes-panel');
      await waitFor(() => expect(diffText(changesPanel)).toContain('export const agent = {};'));

      await user.click(within(changesPanel).getByRole('button', { name: 'Branch changes' }));
      await user.click(await screen.findByRole('menuitemradio', { name: 'Uncommitted changes' }));

      await waitFor(() => expect(diffText(changesPanel)).toContain('draft notes'));
      expect(diffText(changesPanel)).not.toContain('export const agent = {};');
      expect(within(changesPanel).getByRole('button', { name: 'Jump to file, 1 file' })).toBeInTheDocument();
    });

    it('does not present cached change totals after a refresh fails', async () => {
      installHandlers();
      server.use(
        pendingChangesHandler(),
        patchesHandler({
          branch: { changes: [AGENT_CHANGE], patches: { [AGENT_CHANGE.path]: AGENT_PATCH } },
          uncommitted: { changes: [], patches: {} },
        }),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      const changesButton = await screen.findByRole('button', { name: /Changes/ });
      await screen.findByText('+4');
      await user.click(changesButton);
      const changesPanel = await screen.findByTestId('workspace-changes-panel');
      await within(changesPanel).findByRole('button', { name: 'Jump to file, 1 file' });

      server.use(
        http.get(CHANGES_URL, () => HttpResponse.json({ error: 'Unable to read changes' }, { status: 500 })),
        http.get(PATCHES_URL, () => HttpResponse.json({ error: 'Unable to read changes' }, { status: 500 })),
      );
      await openPropertiesMenu(user, 'Changes options');
      await user.click(await screen.findByRole('menuitem', { name: 'Refresh' }));
      await screen.findByText('Unable to read changes');
      expect(within(changesPanel).queryByRole('button', { name: /^Jump to file/ })).not.toBeInTheDocument();
      expect(within(changesPanel).queryByText('+4')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Back to workspace' }));

      expect(await screen.findByText('Unavailable')).toBeInTheDocument();
      expect(screen.queryByText('+4')).not.toBeInTheDocument();
    });

    it('remembers the diff layout picked from the options menu', async () => {
      installHandlers();
      server.use(
        pendingChangesHandler(),
        patchesHandler({
          branch: { changes: [AGENT_CHANGE], patches: { [AGENT_CHANGE.path]: AGENT_PATCH } },
          uncommitted: { changes: [], patches: {} },
        }),
      );
      const user = userEvent.setup();
      const openChanges = async () => {
        await user.click(await screen.findByRole('button', { name: /Changes/ }));
        const changesPanel = await screen.findByTestId('workspace-changes-panel');
        await waitFor(() => expect(diffText(changesPanel)).toContain('export const agent = {};'));
        return changesPanel;
      };

      const { unmount } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      const changesPanel = await openChanges();
      expect(diffLayoutOf(changesPanel)).toBe('single');

      await openPropertySubmenu(user, 'Changes options', 'Diff layout');
      await user.click(screen.getByRole('menuitemradio', { name: 'Split' }));
      await waitFor(() => expect(diffLayoutOf(changesPanel)).toBe('split'));
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

      unmount();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
      expect(diffLayoutOf(await openChanges())).toBe('split');
    });
  });

  describe('when the session sandbox is not running', () => {
    it('offers to wake the sandbox instead of pretending changes are pending', async () => {
      installHandlers();
      // Changes are the live-VM-backed surface: the server reports
      // `available: false` when no session sandbox is running (nothing is
      // ever provisioned by browsing).
      server.use(
        http.get(CHANGES_URL, () => HttpResponse.json({ workspacePath: WORKSPACE, available: false, changes: [] })),
        http.get(PATCHES_URL, () =>
          HttpResponse.json({
            workspacePath: WORKSPACE,
            available: false,
            changes: [],
            scope: 'branch',
            patches: {},
            omittedPatches: {},
          }),
        ),
      );
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

      const changesButton = screen.getByRole('button', { name: /^Changes/ });
      await waitFor(() => expect(changesButton).toHaveTextContent(/^Changes$/));
      await user.click(changesButton);

      expect(await screen.findByText(/The sandbox isn.t running/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Wake sandbox' })).toBeInTheDocument();
    });
  });
});
