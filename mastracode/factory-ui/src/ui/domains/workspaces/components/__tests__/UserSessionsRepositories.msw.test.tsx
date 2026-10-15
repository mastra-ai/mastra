/**
 * The sessions sidebar lists the Factory's sessions in one request, whichever linked repository each one is on.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { SessionsSection } from '../SessionsSection';
import { testChatSession } from './fixtures/sessionsSection';

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

function stubRepositories(repositoryIds: string[], sessions: FactoryUserSession[] | 'error') {
  const requestedFactoryIds: string[] = [];
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
            repositories: repositoryIds.map(id => ({
              id,
              branch: 'main',
              sandboxWorkdir: `/workspace/${id}`,
              repository: { slug: `octo/${id}`, defaultBranch: 'main' },
            })),
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, ({ params }) => {
      requestedFactoryIds.push(String(params.factoryId));
      if (sessions === 'error') return HttpResponse.json({ error: 'boom' }, { status: 500 });
      return HttpResponse.json({ sessions });
    }),
  );
  return requestedFactoryIds;
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', 'ghp-1')}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('User sessions across linked repositories', () => {
  it('lists sessions from every linked repository with one Factory request', async () => {
    const requested = stubRepositories(
      ['ghp-1', 'ghp-2'],
      [userSession('ghp-1', 'sess-1', 'Fix the app'), userSession('ghp-2', 'sess-2', 'Tune the api')],
    );

    renderSection();

    expect(await screen.findByText('Fix the app')).toBeInTheDocument();
    expect(await screen.findByText('Tune the api')).toBeInTheDocument();
    expect(requested).toEqual(['fp-1']);
  });

  it('offers a retry when the Factory sessions fail to load', async () => {
    stubRepositories(['ghp-1', 'ghp-2'], 'error');

    renderSection();

    expect(await screen.findByText('Couldn’t load sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('offers a retry when the sessions fail to load and no repository is linked', async () => {
    stubRepositories([], 'error');

    renderSection();

    expect(await screen.findByText('Couldn’t load sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
