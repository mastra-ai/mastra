/**
 * BDD coverage for workspace deletion: the checkout goes, the transcript stays.
 *
 * Deleting a workspace used to cascade into every thread that ran inside it, so
 * the record of what an agent looked at and decided was destroyed along with a
 * disposable checkout. This asserts the session is deleted and that no thread is
 * touched on the way out.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, onTestFinished } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { WorkspacesSection } from '../WorkspacesSection';

const projectRepositoryId = 'ghp-1';
const sessionId = 'sess-1';

const workspace: FactoryUserSession = {
  id: 'row-1',
  sessionId,
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  branch: 'factory/pr-20474',
  baseBranch: 'main',
  sandboxId: 'sbx-1',
  sandboxWorkdir: '/workspace/repo',
  materializedAt: '2026-07-23T00:00:00.000Z',
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <ChatSessionContext.Provider
        value={{
          resourceId: 'resource-1',
          sessionEnabled: true,
          resourceReady: true,
          sandboxReady: true,
          sandboxPreparing: false,
          resourceEnabled: true,
          factorySessionState: { factoryProjectId: 'fp-1', projectRepositoryId },
          baseUrl: TEST_BASE_URL,
          kind: 'factory',
        }}
      >
        <Routes>
          <Route path="/factories/:factoryId" element={<WorkspacesSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('Deleting a workspace', () => {
  it('removes the session without deleting the threads that ran inside it', async () => {
    let sessions = [workspace];
    const deletedSessions: string[] = [];
    const threadRequests: string[] = [];

    server.use(
      http.get(`${TEST_BASE_URL}/web/source-control/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({ sessions }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ items: [] })),
      http.delete(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
        deletedSessions.push(String(params.sessionId));
        sessions = sessions.filter(session => session.sessionId !== params.sessionId);
        return HttpResponse.json({ removed: true });
      }),
    );

    const recordThreadRequest = ({ request }: { request: Request }) => {
      const { pathname } = new URL(request.url);
      if (pathname.includes('/threads')) threadRequests.push(`${request.method} ${pathname}`);
    };
    server.events.on('request:start', recordThreadRequest);
    onTestFinished(() => server.events.removeListener('request:start', recordThreadRequest));

    const user = userEvent.setup();
    const { client } = renderSection();

    const group = await screen.findByRole('region', { name: 'Review Sessions' });
    await user.click(within(group).getByRole('button', { name: 'Session actions for factory/pr-20474' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Threads from this workspace are kept/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deletedSessions).toEqual([sessionId]));
    await waitForMutationsIdle(client);
    expect(threadRequests).toEqual([]);
  });
});
