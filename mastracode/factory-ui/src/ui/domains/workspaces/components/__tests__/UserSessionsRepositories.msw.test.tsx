/**
 * The sessions sidebar lists sessions from every repository linked to the Factory, not just the first.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

function userSession(projectRepositoryId: string, sessionId: string, title: string): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title,
    branch: `user/${sessionId}`,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: '2026-07-23T00:00:00.000Z',
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  };
}

function stubRepositories(sessionsByRepository: Record<string, FactoryUserSession[] | 'error'>) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authEnabled: true, authenticated: true, user: { userId: 'user-1' } }),
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
            repositories: Object.keys(sessionsByRepository).map(id => ({
              id,
              branch: 'main',
              sandboxWorkdir: `/workspace/${id}`,
              repository: { slug: `octo/${id}`, defaultBranch: 'main' },
            })),
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/source-control/projects/:id/sessions`, ({ params }) => {
      const sessions = sessionsByRepository[String(params.id)];
      if (sessions === 'error' || !sessions) return HttpResponse.json({ error: 'boom' }, { status: 500 });
      return HttpResponse.json({ sessions });
    }),
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

describe('UserSessionsSection across linked repositories', () => {
  it('lists sessions from every linked repository', async () => {
    stubRepositories({
      'ghp-1': [userSession('ghp-1', 'sess-1', 'Fix the app')],
      'ghp-2': [userSession('ghp-2', 'sess-2', 'Tune the api')],
    });

    renderSection();

    expect(await screen.findByText('Fix the app')).toBeTruthy();
    expect(await screen.findByText('Tune the api')).toBeTruthy();
  });

  it('keeps the other repositories listed and offers a retry when one repository fails', async () => {
    stubRepositories({ 'ghp-1': 'error', 'ghp-2': [userSession('ghp-2', 'sess-2', 'Tune the api')] });

    renderSection();

    expect(await screen.findByText('Tune the api')).toBeTruthy();
    expect(await screen.findByText('Couldn’t load sessions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
