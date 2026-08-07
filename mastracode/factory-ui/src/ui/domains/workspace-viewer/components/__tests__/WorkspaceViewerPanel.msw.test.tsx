import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

const FILES_URL = `${TEST_BASE_URL}/web/workspace/files`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
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
  );
  return fileRequests;
}

describe('WorkspaceViewerPanel', () => {
  describe('when a thread has persisted workspace files', () => {
    it('renders the persisted paths instead of enumerating the sandbox', async () => {
      installHandlers();

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

      expect(await screen.findByText('README.md')).toBeInTheDocument();
      expect(screen.getByText('src')).toBeInTheDocument();
      expect(screen.queryByText('Artifacts')).not.toBeInTheDocument();
    });

    it('reads the selected persisted path from the live workspace filesystem', async () => {
      const fileRequests = installHandlers();
      const user = userEvent.setup();
      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

      await user.click(await screen.findByRole('button', { name: 'src' }));
      await user.click(await screen.findByText('agent.ts'));

      const viewer = await screen.findByLabelText('Workspace file viewer');
      expect(viewer).toHaveTextContent('export {}');
      expect(fileRequests).toEqual([{ path: 'src/agent.ts', threadId: THREAD }]);
    });
  });

  describe('when no terminal file capture exists', () => {
    it('explains that the file list is captured after a run ends', async () => {
      server.use(
        http.get(FILES_URL, () => HttpResponse.json({ workspacePath: WORKSPACE, threadId: THREAD, files: [] })),
      );

      renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} threadId={THREAD} />);

      expect(await screen.findByText('No files captured for this run yet.')).toBeInTheDocument();
    });
  });
});
