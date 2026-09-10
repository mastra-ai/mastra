/**
 * BDD coverage for the User Sessions sidebar order: the most recently updated
 * session leads, with pins and ownership still taking precedence over recency.
 * Before this, the comparator stopped after pinned/own, so the rest of the list
 * fell through to the sessions endpoint — which sorts nothing — and rendered in
 * whatever order storage happened to return.
 *
 * Every fixture list is stubbed against its expectation so a comparator that
 * dropped a term would fail rather than coincidentally agree.
 */
import type { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

const projectRepositoryId = 'ghp-1';
const viewerUserId = 'user-viewer-9';

/** `updatedAt` is the ordering input under test; the label comes from the branch suffix. */
function userSession(overrides: Partial<FactoryUserSession>): FactoryUserSession {
  return {
    id: 'row-1',
    sessionId: 'sess-1',
    projectRepositoryId,
    orgId: 'org-1',
    userId: viewerUserId,
    visibility: 'org',
    branch: 'user/my-feature',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: '2026-07-23T00:00:00.000Z',
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

function stubSessions(sessions: FactoryUserSession[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authEnabled: true, authenticated: true, user: { userId: viewerUserId, name: 'Ada' } }),
    ),
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
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <Routes>
        <Route path="/factories/:factoryId" element={<UserSessionsSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

/**
 * Rows only hold their final order once the sessions query has landed. Scoping to
 * the section's own region keeps the filter and "New user session" controls out.
 */
async function sessionRowLabels(client: QueryClient, expected: string[]): Promise<(string | null)[]> {
  await waitForMutationsIdle(client);
  const section = screen.getByRole('region', { name: 'User sessions' });
  const rows = await within(section).findAllByRole('button', { name: new RegExp(`^(${expected.join('|')})$`) });
  return rows.map(row => row.getAttribute('aria-label'));
}

describe('User Sessions sidebar order', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
  });

  it('lists the most recently updated session first', async () => {
    stubSessions([
      userSession({ id: 'row-a', sessionId: 'sess-a', branch: 'user/oldest', updatedAt: '2026-07-23T09:00:00.000Z' }),
      userSession({ id: 'row-b', sessionId: 'sess-b', branch: 'user/newest', updatedAt: '2026-07-23T11:00:00.000Z' }),
      userSession({ id: 'row-c', sessionId: 'sess-c', branch: 'user/middle', updatedAt: '2026-07-23T10:00:00.000Z' }),
    ]);

    const { client } = renderSection();

    expect(await sessionRowLabels(client, ['newest', 'middle', 'oldest'])).toEqual(['newest', 'middle', 'oldest']);
  });

  it('keeps a pinned session on top of a more recently updated one', async () => {
    localStorage.setItem('mastracode.pinnedSessions', JSON.stringify(['sess-stale']));
    stubSessions([
      userSession({
        id: 'row-f',
        sessionId: 'sess-fresh',
        branch: 'user/fresh',
        updatedAt: '2026-07-23T11:00:00.000Z',
      }),
      userSession({
        id: 'row-s',
        sessionId: 'sess-stale',
        branch: 'user/stale',
        updatedAt: '2026-07-23T09:00:00.000Z',
      }),
    ]);

    const { client } = renderSection();

    expect(await sessionRowLabels(client, ['stale', 'fresh'])).toEqual(['stale', 'fresh']);
  });

  it("keeps the viewer's own session above a more recently updated one owned by someone else", async () => {
    stubSessions([
      userSession({
        id: 'row-other',
        sessionId: 'sess-other',
        userId: 'user-owner-1',
        owner: { id: 'user-owner-1', name: 'Grace Hopper' },
        branch: 'user/theirs',
        updatedAt: '2026-07-23T11:00:00.000Z',
      }),
      userSession({
        id: 'row-mine',
        sessionId: 'sess-mine',
        branch: 'user/mine',
        updatedAt: '2026-07-23T09:00:00.000Z',
      }),
    ]);

    const { client } = renderSection();

    expect(await sessionRowLabels(client, ['mine', 'theirs'])).toEqual(['mine', 'theirs']);
  });

  it('falls back to session id when two sessions share an updated time', async () => {
    const sharedUpdate = '2026-07-23T10:00:00.000Z';
    stubSessions([
      userSession({ id: 'row-aaa', sessionId: 'sess-aaa', branch: 'user/alpha', updatedAt: sharedUpdate }),
      userSession({ id: 'row-bbb', sessionId: 'sess-bbb', branch: 'user/beta', updatedAt: sharedUpdate }),
    ]);

    const { client } = renderSection();

    expect(await sessionRowLabels(client, ['alpha', 'beta'])).toEqual(['beta', 'alpha']);
  });
});
