import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../../../../api/keys';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

const FILES_URL = `${TEST_BASE_URL}/web/workspace/files`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const DIFF_URL = `${TEST_BASE_URL}/web/workspace/changes/diff`;
const WORKSPACE = 'session-1';
const THREAD = 'thread-1';

function installHandlers() {
  const fileRequests: Array<{ path: string | null; threadId: string | null }> = [];
  server.use(
    http.get(FILES_URL, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json({
        workspacePath: url.searchParams.get('workspacePath'),
        threadId: url.searchParams.get('threadId'),
        files: [{ path: 'src/agent.ts' }, { path: 'README.md' }],
      });
    }),
    http.get(FILE_URL, ({ request }) => {
      const url = new URL(request.url);
      const path = url.searchParams.get('path');
      const threadId = url.searchParams.get('threadId');
      fileRequests.push({ path, threadId });
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
  return fileRequests;
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
  describe('when a thread has persisted workspace files', () => {
    it('renders the persisted paths instead of enumerating the sandbox', async () => {
      installHandlers();
      const user = userEvent.setup();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);
      await user.click(await screen.findByRole('button', { name: /Files/ }));

      expect(await screen.findByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.queryByText('Artifacts')).not.toBeInTheDocument();
    });

    it('refreshes the selected file and preserves the expanded folder', async () => {
      const fileRequests = installHandlers();
      const user = userEvent.setup();
      const { client } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);
      await user.click(await screen.findByRole('button', { name: /Files/ }));

      await user.click(await screen.findByRole('button', { name: 'src' }));
      await user.click(await screen.findByText('agent.ts'));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      expect(viewer).toHaveTextContent('export {}');
      expect(fileRequests).toEqual([{ path: 'src/agent.ts', threadId: THREAD }]);

      await user.click(screen.getByRole('button', { name: 'Refresh file' }));
      await waitFor(() => expect(fileRequests).toHaveLength(2));
      await waitForMutationsIdle(client);
      await user.click(screen.getByRole('button', { name: 'Back to workspace files' }));

      expect(screen.getByRole('button', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('agent.ts')).toBeInTheDocument();
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

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

      await screen.findByText('+4');
      const changesButton = screen.getByRole('button', { name: /Changes/ });
      expect(changesButton).toHaveTextContent('−1');
      await user.click(changesButton);
      await user.click(await screen.findByText('agent.ts'));

      const changesPanel = await screen.findByTestId('workspace-changes-panel');
      expect(await within(changesPanel).findByLabelText('Workspace change diff')).toHaveTextContent(
        'export const agent = {};',
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
            patch: '@@ -1 +1 @@\n-export {}\n+export const agent = {};\n',
            truncated: false,
          });
        }),
      );
      const user = userEvent.setup();
      const { client } = renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

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

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);
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

  describe('when no terminal file capture exists', () => {
    it('shows a muted empty status without opening the files view', async () => {
      installHandlers();
      server.use(
        http.get(FILES_URL, () => HttpResponse.json({ workspacePath: WORKSPACE, threadId: THREAD, files: [] })),
      );

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

      expect(await screen.findByRole('button', { name: /Files No files/ })).toBeInTheDocument();
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

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

      const changesButton = await screen.findByRole('button', { name: /Changes No sandbox/ });
      await user.click(changesButton);

      expect(
        await screen.findByText('No sandbox running. Changes appear once the session sandbox starts.'),
      ).toBeInTheDocument();
    });
  });
});
