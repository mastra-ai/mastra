import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { WorkspaceFilesProvider } from '../../context/WorkspaceFilesProvider';
import { WorkspaceFilesSurface } from '../WorkspaceFilesSurface';
import { WorkspaceFilesToggle } from '../WorkspaceFilesToggle';

const LIST_URL = `${TEST_BASE_URL}/web/workspace/files`;
const WORKSPACE = 'session-1';

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

/** jsdom reports every box as 0×0, so the dock threshold needs a width to measure against. */
function stubContainerWidth(width: number) {
  HTMLElement.prototype.getBoundingClientRect = () => ({
    width,
    height: 800,
    top: 0,
    left: 0,
    right: width,
    bottom: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

function renderPanel() {
  const listRequests: Array<{ workspacePath: string | null; threadId: string | null }> = [];
  server.use(
    http.get(LIST_URL, ({ request }) => {
      const url = new URL(request.url);
      listRequests.push({
        workspacePath: url.searchParams.get('workspacePath'),
        threadId: url.searchParams.get('threadId'),
      });
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        threadId: 'thread-1',
        files: [],
      });
    }),
  );

  const { client } = renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/factory-1/workspaces/${WORKSPACE}/threads/thread-1`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <WorkspaceFilesProvider>
              <WorkspaceFilesToggle />
              <WorkspaceFilesSurface />
            </WorkspaceFilesProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

  return { client, listRequests };
}

describe('WorkspaceFiles', () => {
  describe('given a chat wide enough for the card beside the transcript', () => {
    it('leaves the card closed and off the network until the header toggle asks for it', async () => {
      stubContainerWidth(1200);
      const user = userEvent.setup();
      const { client, listRequests } = renderPanel();

      const card = await screen.findByTestId('workspace-files-card');
      const toggle = screen.getByRole('button', { name: 'Workspace files' });
      expect(card).toHaveAttribute('inert');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(listRequests).toEqual([]);

      await user.click(toggle);

      expect(card).not.toHaveAttribute('inert');
      expect(await screen.findByRole('tab', { name: 'Files' })).toBeInTheDocument();
      await waitForMutationsIdle(client);
      expect(listRequests).toEqual([{ workspacePath: WORKSPACE, threadId: 'thread-1' }]);
    });
  });

  describe('given a chat too narrow to hold both', () => {
    it('overlays the files in a popover instead of taking the transcript width', async () => {
      stubContainerWidth(900);
      const user = userEvent.setup();
      renderPanel();

      expect(screen.queryByTestId('workspace-files-card')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Files' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Workspace files' }));

      expect(await screen.findByRole('tab', { name: 'Files' })).toBeInTheDocument();
    });
  });
});
