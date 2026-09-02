import assert from 'node:assert';

import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionConfigProvider } from '../../../chat/context/ChatSessionProvider';
import { WorkspacesSection } from '../WorkspacesSection';
import {
  createSessionHoverDetailsFixtures,
  factoryId,
  projectRepositoryId,
  reviewName,
  workName,
  workSessionId,
} from './fixtures/sessionHoverDetails';

function stubWith(activeSessionIds: string[]) {
  const fixtures = createSessionHoverDetailsFixtures(new Date().toISOString());

  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json(fixtures.projectsResponse)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
      HttpResponse.json(fixtures.connectionsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json(fixtures.sessionsResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${workSessionId}`, () =>
      HttpResponse.json(fixtures.currentSessionResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json(fixtures.workItemsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/active-runs`, () =>
      HttpResponse.json({
        runs: activeSessionIds.map(sessionId => ({
          runId: `run-${sessionId}`,
          resourceId: sessionId,
          threadId: sessionId,
        })),
      }),
    ),
  );
}

function renderSection() {
  return renderAt(
    '/factories/:factoryId/workspaces/:sessionId/threads/:threadId',
    `/factories/${factoryId}/workspaces/${workSessionId}/threads/${workSessionId}`,
  );
}

function renderAt(path: string, entry: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path={path}
          element={
            <ChatSessionConfigProvider>
              <WorkspacesSection />
            </ChatSessionConfigProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Workspace activity indicators', () => {
  it('lights the running belt for a session with an active run', async () => {
    stubWith([workSessionId]);

    renderSection();

    const belt = await screen.findByRole('status', { name: `Agent working in ${workName}` });
    const actions = screen.getByRole('button', { name: `Session actions for ${workName}` });
    // Its own slot on the row box: the trailing slot collapses on hover and would take the belt with it.
    expect(belt.parentElement).not.toBe(actions.parentElement);
    expect(belt.closest('li')).toBe(actions.closest('li'));
  });

  it('leaves a session without an active run unmarked', async () => {
    stubWith([]);

    renderSection();

    // The row must exist before the absence of its belt means anything.
    const row = (await screen.findByRole('button', { name: workName })).closest('li');
    assert(row);
    expect(within(row).queryByRole('status', { name: `Agent working in ${workName}` })).not.toBeInTheDocument();
  });

  it('lights the belt on a page that has no workspace session open', async () => {
    stubWith([workSessionId]);

    renderAt('/factories/:factoryId/work', `/factories/${factoryId}/work`);

    expect(await screen.findByRole('status', { name: `Agent working in ${workName}` })).toBeInTheDocument();
  });

  it('labels the row with the session title rather than the branch', async () => {
    stubWith([workSessionId]);

    renderSection();

    expect(await screen.findByRole('button', { name: reviewName })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'factory/pr-99-authentication-refresh' })).not.toBeInTheDocument();
  });
});
