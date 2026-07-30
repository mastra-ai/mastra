import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { workspaceChangesFixture, workspaceDiffFixture } from './fixtures/workspace-changes';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';
import { useInvalidateWorkspaceChangesOnRunCompletion } from '../../useInvalidateWorkspaceChangesOnRunCompletion';

const LIST_URL = `${TEST_BASE_URL}/web/workspace/rendered/list`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const DIFF_URL = `${TEST_BASE_URL}/web/workspace/changes/diff`;
const WORKSPACE = '/home/user/project';

const renderedPaths = [{ id: 'artifacts', label: 'Artifacts', root: '.artifacts' }];

function WorkspaceChangesRunHarness({ busy }: { busy: boolean }) {
  useInvalidateWorkspaceChangesOnRunCompletion(WORKSPACE, busy);
  return <WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />;
}

function installHandlers() {
  const fileRequests: string[] = [];
  server.use(
    http.get(LIST_URL, ({ request }) => {
      const root = new URL(request.url).searchParams.get('root');
      if (root === '.reports') {
        return HttpResponse.json({
          workspacePath: WORKSPACE,
          root: '.reports',
          rootPath: `${WORKSPACE}/.reports`,
          entries: [
            { name: 'summary.md', path: 'summary.md', type: 'file', size: 7, updatedAt: '2026-07-16T00:00:00.000Z' },
          ],
        });
      }
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        root: '.artifacts',
        rootPath: `${WORKSPACE}/.artifacts`,
        entries: [
          {
            name: 'understand-pr',
            path: 'understand-pr',
            type: 'directory',
            size: 0,
            updatedAt: '2026-07-16T00:00:00.000Z',
          },
          {
            name: 'HISTORY.md',
            path: 'understand-pr/HISTORY.md',
            type: 'file',
            size: 7,
            updatedAt: '2026-07-16T00:00:00.000Z',
          },
        ],
      });
    }),
    http.get(FILE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path');
      if (path) fileRequests.push(path);
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        path,
        name: path?.split('/').pop() ?? 'file.md',
        size: 7,
        updatedAt: '2026-07-16T00:00:00.000Z',
        contentType: 'text',
        content: '# Notes',
      });
    }),
  );
  return fileRequests;
}

describe('WorkspaceViewerPanel', () => {
  it('shows an empty state for configured paths with no files', async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json({
          workspacePath: WORKSPACE,
          root: '.artifacts',
          rootPath: `${WORKSPACE}/.artifacts`,
          entries: [],
        }),
      ),
    );

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Artifacts' }));
    expect(await screen.findByText('No artifacts yet. Session files created will appear here.')).toBeInTheDocument();
  });

  it('expands folders inline and swaps the browser for the selected file viewer', async () => {
    const fileRequests = installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    const root = await screen.findByRole('button', { name: 'Artifacts' });
    expect(root).toHaveAttribute('aria-expanded', 'false');
    await user.click(root);
    expect(root).toHaveAttribute('aria-expanded', 'true');

    const folder = await screen.findByRole('button', { name: 'understand-pr' });
    expect(folder).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('HISTORY.md')).not.toBeInTheDocument();

    await user.click(folder);

    expect(folder).toHaveAttribute('aria-expanded', 'true');
    await user.click(folder);
    expect(folder).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('HISTORY.md')).not.toBeInTheDocument();

    await user.click(folder);
    expect(folder).toHaveAttribute('aria-expanded', 'true');
    await user.click(await screen.findByText('HISTORY.md'));

    const viewer = await screen.findByLabelText('Workspace file viewer');
    expect(viewer).toBeInTheDocument();
    expect(await screen.findByText('Notes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace files')).not.toBeInTheDocument();
    expect(fileRequests).toContain('.artifacts/understand-pr/HISTORY.md');
    expect(fileRequests).not.toContain('understand-pr/HISTORY.md');
  });

  it('can switch between configured rendered roots', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceViewerPanel
        workspacePath={WORKSPACE}
        renderedPaths={[...renderedPaths, { id: 'reports', label: 'Reports', root: '.reports' }]}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Reports' }));

    expect(await screen.findByText('summary.md')).toBeInTheDocument();
  });

  it('returns from file content to the file browser', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await user.click(await screen.findByRole('button', { name: 'understand-pr' }));
    await user.click(await screen.findByText('HISTORY.md'));

    expect(await screen.findByLabelText('Workspace file viewer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to workspace files' }));

    expect(screen.queryByLabelText('Workspace file viewer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Workspace files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Artifacts' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows progress while refreshing the current listing', async () => {
    let calls = 0;
    let delayRefresh = false;
    let releaseRefresh = () => {};
    const refreshGate = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });
    server.use(
      http.get(LIST_URL, async () => {
        calls += 1;
        if (delayRefresh) await refreshGate;
        return HttpResponse.json({
          workspacePath: WORKSPACE,
          root: '.artifacts',
          rootPath: `${WORKSPACE}/.artifacts`,
          entries: [],
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(await screen.findByRole('button', { name: 'Artifacts' }));
    await screen.findByText('No artifacts yet. Session files created will appear here.');
    delayRefresh = true;
    await user.click(screen.getByRole('button', { name: 'Refresh workspace files' }));

    expect(await screen.findByRole('button', { name: 'Refreshing workspace files' })).toBeDisabled();
    releaseRefresh();
    expect(await screen.findByRole('button', { name: 'Refresh workspace files' })).toBeEnabled();
    expect(calls).toBeGreaterThan(1);
  });

  it('colors changed files while keeping their folders neutral', async () => {
    server.use(
      http.get(CHANGES_URL, () =>
        HttpResponse.json({
          workspacePath: WORKSPACE,
          available: true,
          additions: 3,
          deletions: 1,
          changes: [{ path: 'docs/README.md', status: 'modified', additions: 3, deletions: 1 }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(screen.getByRole('tab', { name: 'Changes' }));

    expect(await screen.findByText('docs')).toHaveClass('text-neutral4!');
    expect(screen.getByText('README.md')).toHaveClass('text-notice-info/70!');
  });

  it('requests both paths and renders the rename diff for a renamed file', async () => {
    let requestedPreviousPath: string | undefined;
    server.use(
      http.get(CHANGES_URL, () =>
        HttpResponse.json({
          workspacePath: WORKSPACE,
          available: true,
          additions: 4,
          deletions: 2,
          changes: [
            {
              path: 'src/new-name.ts',
              previousPath: 'src/old-name.ts',
              status: 'renamed',
              additions: 4,
              deletions: 2,
            },
          ],
        }),
      ),
      http.get(DIFF_URL, ({ request }) => {
        requestedPreviousPath = new URL(request.url).searchParams.get('previousPath') ?? undefined;
        return HttpResponse.json({
          ...workspaceDiffFixture,
          path: 'src/new-name.ts',
          patch: '@@ -1 +1 @@\n-old name\n+new name',
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(screen.getByRole('tab', { name: 'Changes' }));
    await user.click(await screen.findByRole('treeitem', { name: /^old-name\.ts → new-name\.ts.*Renamed/ }));

    expect(await screen.findByText('+new name')).toBeInTheDocument();
    expect(requestedPreviousPath).toBe('src/old-name.ts');
  });

  it('loads a selected pending diff on demand', async () => {
    const diffRequests: string[] = [];
    server.use(
      http.get(CHANGES_URL, () => HttpResponse.json(workspaceChangesFixture)),
      http.get(DIFF_URL, ({ request }) => {
        const path = new URL(request.url).searchParams.get('path');
        if (path) diffRequests.push(path);
        if (path === 'src/new.ts') {
          return HttpResponse.json({
            ...workspaceDiffFixture,
            path,
            patch: '@@ -0,0 +1 @@\n+new file contents',
          });
        }
        return HttpResponse.json(workspaceDiffFixture);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(await screen.findByText('Changes (2)')).toBeInTheDocument();
    expect(screen.getByText('2 files changed')).toBeInTheDocument();
    expect(screen.getByLabelText('8 additions and 1 deletion')).toBeInTheDocument();
    expect(screen.getByLabelText('3 additions and 1 deletion')).toBeInTheDocument();
    expect(screen.getByLabelText('5 additions and 0 deletions')).toBeInTheDocument();
    expect(diffRequests).toEqual([]);

    expect(screen.getByText('src')).toHaveClass('text-neutral4!');
    expect(screen.getByText('edited.ts')).toHaveClass('text-notice-info/70!');
    expect(screen.getByText('new.ts')).toHaveClass('text-notice-success/70!');
    const srcFolder = screen.getByText('src').closest('[role="treeitem"]');
    expect(srcFolder).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByText('src'));
    expect(srcFolder).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: /edited\.ts.*Modified/ })).not.toBeInTheDocument();
    await user.click(screen.getByText('src'));

    const editedFile = screen.getByRole('treeitem', { name: /^edited\.ts.*Modified/ });
    await user.click(editedFile);

    expect(await screen.findByText('-old value')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-preview-interactive')).toHaveAttribute('data-drawer-content');
    expect(screen.getByText('+new value')).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(screen.queryByText(/diff --git/)).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /^edited\.ts.*Modified/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Refresh changes' }).parentElement).toHaveClass('pr-12');

    await user.click(screen.getByRole('button', { name: 'Open full-screen changes viewer' }));
    expect(screen.getByRole('dialog')).toHaveClass('w-[calc(100vw-3.5rem)]');
    await user.click(screen.getByRole('button', { name: 'Exit full-screen changes viewer' }));
    expect(screen.getByRole('button', { name: 'Open full-screen changes viewer' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Changes (2)' })).toBeVisible();
    expect(diffRequests).toEqual(['src/edited.ts']);

    const newFile = screen.getByRole('treeitem', { name: /^new\.ts.*Untracked/ });
    await user.click(newFile);
    await waitFor(() => expect(diffRequests).toEqual(['src/edited.ts', 'src/new.ts']));
    expect(await screen.findByText('+new file contents')).toBeInTheDocument();
    expect(screen.queryByText('-old value')).not.toBeInTheDocument();
    expect(newFile).toHaveAttribute('aria-selected', 'true');
  });

  it('preserves added and deleted content that resembles diff headers', async () => {
    server.use(
      http.get(CHANGES_URL, () => HttpResponse.json(workspaceChangesFixture)),
      http.get(DIFF_URL, () =>
        HttpResponse.json({
          ...workspaceDiffFixture,
          patch: [
            'diff --git a/src/edited.ts b/src/edited.ts',
            '--- a/src/edited.ts',
            '+++ b/src/edited.ts',
            '@@ -1 +1 @@',
            '--- removed content',
            '+++ added content',
          ].join('\n'),
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(screen.getByRole('tab', { name: 'Changes' }));
    await user.click(await screen.findByRole('treeitem', { name: /^edited\.ts.*Modified/ }));

    expect(await screen.findByText('--- removed content')).toBeInTheDocument();
    expect(screen.getByText('+++ added content')).toBeInTheDocument();
    expect(screen.queryByText('--- a/src/edited.ts')).not.toBeInTheDocument();
    expect(screen.queryByText('+++ b/src/edited.ts')).not.toBeInTheDocument();
  });

  it('refreshes pending changes when an agent run completes', async () => {
    let requests = 0;
    server.use(
      http.get(CHANGES_URL, () => {
        requests += 1;
        return HttpResponse.json({
          workspacePath: WORKSPACE,
          available: true,
          additions: requests === 1 ? 3 : 8,
          deletions: 1,
          changes:
            requests === 1
              ? [{ path: 'src/edited.ts', status: 'modified', additions: 3, deletions: 1 }]
              : [
                  { path: 'src/edited.ts', status: 'modified', additions: 3, deletions: 1 },
                  { path: 'src/new.ts', status: 'untracked', additions: 5, deletions: 0 },
                ],
        });
      }),
    );
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<WorkspaceChangesRunHarness busy={false} />);
    await user.click(screen.getByRole('tab', { name: 'Changes' }));
    expect(await screen.findByText('Changes (1)')).toBeInTheDocument();

    rerender(<WorkspaceChangesRunHarness busy />);
    rerender(<WorkspaceChangesRunHarness busy={false} />);

    expect(await screen.findByText('Changes (2)')).toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it('shows progress while refreshing pending changes', async () => {
    let delayRefresh = false;
    let releaseRefresh = () => {};
    const refreshGate = new Promise<void>(resolve => {
      releaseRefresh = resolve;
    });
    server.use(
      http.get(CHANGES_URL, async () => {
        if (delayRefresh) await refreshGate;
        return HttpResponse.json(workspaceChangesFixture);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await user.click(screen.getByRole('tab', { name: 'Changes' }));
    await screen.findByText('Changes (2)');
    delayRefresh = true;
    await user.click(screen.getByRole('button', { name: 'Refresh changes' }));

    expect(await screen.findByRole('button', { name: 'Refreshing changes' })).toBeDisabled();
    releaseRefresh();
    expect(await screen.findByRole('button', { name: 'Refresh changes' })).toBeEnabled();
  });
});
