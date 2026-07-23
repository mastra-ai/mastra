import { createMemoryRouter, RouterProvider } from 'react-router';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/web-ui/render';
import type { WorkspaceRenderedEntry } from '../../../../shared/api/types';
import { ThreadPage } from '../ThreadPage';

vi.mock('../../layouts/ChatLayout', () => ({
  ChatLayout: ({ rightPanel, rightPanelAvailable }: { rightPanel?: ReactNode; rightPanelAvailable?: boolean }) => (
    <div>
      <span>{rightPanel ? 'workspace-panel-visible' : 'workspace-panel-hidden'}</span>
      <span>{rightPanelAvailable ? 'workspace-panel-available' : 'workspace-panel-unavailable'}</span>
    </div>
  ),
}));

const FACTORY_ID = 'factory-1';
const SESSION_ID = 'session-1';
const SANDBOX_WORKDIR = '/sandbox/repo';
const FACTORIES_URL = `${TEST_BASE_URL}/web/factory/projects`;
const CONNECTIONS_URL = `${FACTORIES_URL}/${FACTORY_ID}/source-control-connections`;
const USER_SESSION_URL = `${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`;
const LIST_URL = `${TEST_BASE_URL}/web/workspace/rendered/list`;

function installHandlers(entries: WorkspaceRenderedEntry[]) {
  const onListing = vi.fn();
  const listingWorkspacePaths: Array<string | null> = [];
  server.use(
    http.get(FACTORIES_URL, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Factory' }] }),
    ),
    http.get(CONNECTIONS_URL, () => HttpResponse.json({ connections: [] })),
    http.get(USER_SESSION_URL, () =>
      HttpResponse.json({
        session: {
          id: 'stored-session-1',
          sessionId: SESSION_ID,
          projectRepositoryId: 'repository-1',
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'factory/demo',
          baseBranch: 'main',
          sandboxId: 'sandbox-1',
          sandboxWorkdir: SANDBOX_WORKDIR,
          materializedAt: '2026-07-23T00:00:00.000Z',
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      }),
    ),
    http.get(LIST_URL, ({ request }) => {
      onListing();
      listingWorkspacePaths.push(new URL(request.url).searchParams.get('workspacePath'));
      return HttpResponse.json({
        workspacePath: SANDBOX_WORKDIR,
        root: '.artifacts',
        rootPath: `${SANDBOX_WORKDIR}/.artifacts`,
        entries,
      });
    }),
  );
  return { onListing, listingWorkspacePaths };
}

function renderThreadPage() {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId/workspaces/:sessionId/threads/:threadId',
        element: <ThreadPage />,
      },
    ],
    { initialEntries: [`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/thread-1`] },
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage workspace panel', () => {
  describe('when the workspace has no rendered artifacts', () => {
    it('keeps the workspace panel hidden', async () => {
      const { onListing } = installHandlers([]);

      renderThreadPage();

      await waitFor(() => expect(onListing).toHaveBeenCalledOnce());
      expect(screen.getByText('workspace-panel-hidden')).toBeInTheDocument();
      expect(screen.getByText('workspace-panel-unavailable')).toBeInTheDocument();
    });
  });

  describe('when the workspace has a rendered artifact', () => {
    it('shows the workspace panel', async () => {
      const { listingWorkspacePaths } = installHandlers([
        {
          name: 'report.md',
          path: 'report.md',
          type: 'file',
          size: 12,
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      ]);

      renderThreadPage();

      expect(await screen.findByText('workspace-panel-visible')).toBeInTheDocument();
      expect(screen.getByText('workspace-panel-available')).toBeInTheDocument();
      expect(listingWorkspacePaths).toEqual([SANDBOX_WORKDIR]);
    });
  });
});
