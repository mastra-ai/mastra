import { createMemoryRouter, RouterProvider } from 'react-router';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/web-ui/render';
import type { WorkspaceRenderedEntry } from '../../../../shared/api/types';
import { ThreadPage } from '../ThreadPage';

vi.mock('../../layouts/ChatLayout', () => ({
  ChatLayout: ({
    main,
    rightPanel,
    rightPanelOpen,
  }: {
    main?: ReactNode;
    rightPanel?: ReactNode;
    rightPanelOpen?: boolean;
  }) => (
    <div>
      <span>{rightPanel ? 'workspace-panel-mounted' : 'workspace-panel-missing'}</span>
      <span>{rightPanelOpen ? 'workspace-panel-open' : 'workspace-panel-closed'}</span>
      {main}
    </div>
  ),
}));

vi.mock('../../domains/chat/context/ChatSessionProvider', () => ({
  ChatSessionBoundary: ({ children }: { children: ReactNode }) => children,
  ChatMessageBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../../domains/chat/components/ChatMessageList', () => ({ ChatMessageList: () => null }));
vi.mock('../../domains/chat/components/ComposerPanel', () => ({ ComposerPanel: () => null }));
vi.mock('../../domains/chat/components/TaskPanel', () => ({ TaskPanel: () => null }));
vi.mock('../../domains/chat/hooks/useGlobalShortcuts', () => ({ useGlobalShortcuts: vi.fn() }));
vi.mock('../../domains/chat/hooks/useThreadPageKickoffs', () => ({ useThreadPageKickoffs: vi.fn() }));
vi.mock('../../../../shared/hooks/useRouteThreadSync', () => ({ useRouteThreadSync: vi.fn() }));

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
    http.get(FACTORIES_URL, () => HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Factory' }] })),
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
        path: '/factories/:factoryId/user/threads/:threadId',
        element: <ThreadPage />,
      },
    ],
    { initialEntries: [`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`] },
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('ThreadPage workspace panel', () => {
  describe('when the workspace has no rendered artifacts', () => {
    it('opens the mounted workspace panel from the session header', async () => {
      const user = userEvent.setup();
      const { onListing } = installHandlers([]);

      renderThreadPage();

      await waitFor(() => expect(onListing).toHaveBeenCalledOnce());
      expect(screen.getByText('workspace-panel-mounted')).toBeInTheDocument();
      expect(screen.getByText('workspace-panel-closed')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Open workspace files' }));

      expect(screen.getByText('workspace-panel-open')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close workspace files' })).toBeInTheDocument();
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

      expect(await screen.findByText('workspace-panel-open')).toBeInTheDocument();
      expect(screen.getByText('workspace-panel-mounted')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close workspace files' })).toBeInTheDocument();
      expect(listingWorkspacePaths).toEqual([SANDBOX_WORKDIR]);
    });
  });
});
