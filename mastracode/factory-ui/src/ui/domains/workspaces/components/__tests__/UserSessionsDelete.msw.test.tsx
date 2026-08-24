import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, onTestFinished } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

const projectRepositoryId = 'ghp-1';
const sessionId = 'sess-1';

const session: FactoryUserSession = {
  id: 'row-1',
  sessionId,
  projectRepositoryId,
  orgId: 'org-1',
  userId: 'user-1',
  visibility: 'org' as const,
  branch: 'user/my-feature',
  baseBranch: 'main',
  sandboxId: null,
  sandboxWorkdir: null,
  materializedAt: null,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('User sessions deletion', () => {
  it('deletes the selected session and removes it from the sidebar', async () => {
    let sessions = [session];
    const deletedSessions: string[] = [];
    const threadRequests: string[] = [];

    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
        HttpResponse.json({ projects: [{ id: 'fp-1', name: 'Mastra' }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/source-control-connections`, () =>
        HttpResponse.json({
          connections: [
            {
              id: 'conn-1',
              installationId: 'inst-7',
              repositories: [
                {
                  id: projectRepositoryId,
                  branch: 'main',
                  sandboxWorkdir: '/workspace/hello',
                  repository: { slug: 'octo/hello', defaultBranch: 'main' },
                },
              ],
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
        HttpResponse.json({ sessions }),
      ),
      http.delete(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, ({ params }) => {
        deletedSessions.push(String(params.sessionId));
        sessions = sessions.filter(item => item.sessionId !== params.sessionId);
        return HttpResponse.json({ removed: true });
      }),
      // Sidebar activity poll — return no active threads so the row stays idle.
      http.get(`${TEST_BASE_URL}/api/agent-controller/:agentControllerId/sessions/:resourceId/threads`, () =>
        HttpResponse.json({ threads: [] }),
      ),
    );

    // Only the sidebar activity poll is allowed to hit the threads endpoint; a stray delete-triggered
    // thread request would signal that removing the session accidentally fired unrelated work.
    const recordThreadRequest = ({ request }: { request: Request }) => {
      const { pathname } = new URL(request.url);
      if (pathname.includes('/threads') && request.method !== 'GET') {
        threadRequests.push(`${request.method} ${pathname}`);
      }
    };
    server.events.on('request:start', recordThreadRequest);
    onTestFinished(() => server.events.removeListener('request:start', recordThreadRequest));

    const user = userEvent.setup();
    const { client } = renderSection();

    await user.click(await screen.findByRole('button', { name: 'Session actions for my-feature' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitForMutationsIdle(client);
    expect(deletedSessions).toEqual([sessionId]);
    expect(threadRequests).toEqual([]);
    expect(screen.queryByRole('button', { name: 'my-feature' })).not.toBeInTheDocument();
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });
});
