/**
 * BDD coverage for the sidebar activity indicators.
 *
 * These rows match a thread to a workspace by tag. Factory review/work threads
 * are stamped with `factorySessionId` (the session id, which is also the
 * sidebar row key), but the matcher only ever read `projectPath` — and
 * `projectPath` now holds the sandbox workdir filesystem path rather than the
 * session id. Nothing matched, so the green "agent working" dot never lit and
 * rows fell back to branch names instead of the PR/issue title.
 *
 * Both keys are exercised here: the `factorySessionId` shape factory sessions
 * actually carry, and the legacy `projectPath` shape personal worktree sessions
 * still use.
 */
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
  reviewSessionId,
  workName,
  workSessionId,
} from './fixtures/sessionHoverDetails';

/** The sandbox workdir now stamped on `projectPath` — never equal to a row key. */
const SANDBOX_WORKDIR = '/workspace/mastra';

type ThreadTags = Record<string, string>;

function stubWith(tagsFor: (sessionId: string) => ThreadTags, states: Record<string, 'active' | 'idle'>) {
  const fixtures = createSessionHoverDetailsFixtures(new Date().toISOString());

  fixtures.threadsResponse.threads = fixtures.threadsResponse.threads.map(thread => {
    const sessionId = thread.id;
    return { ...thread, tags: tagsFor(sessionId), state: states[sessionId] ?? 'idle' };
  });

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
    http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/ensure`, () =>
      HttpResponse.json(fixtures.ensureResponse),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json(fixtures.workItemsResponse),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${workSessionId}/threads`, ({ request }) => {
      expect(new URL(request.url).searchParams.getAll('resourceIds')).toEqual([workSessionId, reviewSessionId]);
      return HttpResponse.json(fixtures.threadsResponse);
    }),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/workspaces/${workSessionId}/threads/${workSessionId}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
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
  it('lights the running dot for a factory thread tagged with factorySessionId', async () => {
    // The real factory shape: matched by `factorySessionId`, while `projectPath`
    // points at the sandbox workdir and matches no row key at all.
    stubWith(sessionId => ({ factorySessionId: sessionId, projectPath: SANDBOX_WORKDIR }), {
      [workSessionId]: 'active',
      [reviewSessionId]: 'idle',
    });

    renderSection();

    const dot = await screen.findByRole('status', { name: `Agent working in ${workName}` });
    const actions = screen.getByRole('button', { name: `Session actions for ${workName}` });
    // Same trailing slot: the menu takes the dot's place on hover instead of covering the label.
    expect(dot.parentElement).toBe(actions.parentElement);
  });

  it('leaves an idle factory thread without a running dot', async () => {
    stubWith(sessionId => ({ factorySessionId: sessionId, projectPath: SANDBOX_WORKDIR }), {
      [workSessionId]: 'idle',
      [reviewSessionId]: 'idle',
    });

    renderSection();

    // The row must exist before the absence of its dot means anything.
    const row = (await screen.findByRole('button', { name: workName })).closest('li');
    assert(row);
    expect(within(row).queryByRole('status', { name: `Agent working in ${workName}` })).not.toBeInTheDocument();
  });

  it('labels the row with the thread title rather than the branch', async () => {
    stubWith(sessionId => ({ factorySessionId: sessionId, projectPath: SANDBOX_WORKDIR }), {
      [workSessionId]: 'active',
      [reviewSessionId]: 'idle',
    });

    renderSection();

    expect(await screen.findByRole('button', { name: reviewName })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'factory/pr-99-authentication-refresh' })).not.toBeInTheDocument();
  });

  it('still matches legacy sessions keyed by projectPath', async () => {
    // Personal/local worktree sessions predate `factorySessionId`; the
    // `projectPath` fallback must keep them working.
    stubWith(sessionId => ({ projectPath: sessionId }), {
      [workSessionId]: 'active',
      [reviewSessionId]: 'idle',
    });

    renderSection();

    expect(await screen.findByRole('status', { name: `Agent working in ${workName}` })).toBeInTheDocument();
  });
});
