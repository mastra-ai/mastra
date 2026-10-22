import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import { SessionsSection } from '../SessionsSection';
import { testChatSession } from './fixtures/sessionsSection';
import { pickSessionProperty, sessionPropertiesTrigger } from './fixtures/sessionProperties';

const projectRepositoryId = 'ghp-1';

function userSession(overrides: Partial<FactoryUserSession>): FactoryUserSession {
  return {
    id: 'row-1',
    sessionId: 'sess-1',
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    branch: 'user/my-feature',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
    ...overrides,
  };
}

function stubSessions(
  sessions: FactoryUserSession[],
  viewerUserId: string,
  viewerProfile: { name?: string; email?: string; avatarUrl?: string } = {},
) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authEnabled: true, authenticated: true, user: { userId: viewerUserId, ...viewerProfile } }),
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
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1']}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

async function showAllOwners() {
  await pickSessionProperty(userEvent.setup(), 'Owner', 'All owners');
  expect(sessionPropertiesTrigger(1)).toBeInTheDocument();
}

describe('user session attribution', () => {
  it('marks sessions owned by others', async () => {
    stubSessions(
      [
        userSession({
          id: 'row-other',
          sessionId: 'sess-other',
          userId: 'user-owner-1',
          owner: { id: 'user-owner-1', name: 'Grace Hopper', avatarUrl: 'https://example.com/grace.png' },
          branch: 'user/alpha',
        }),
        userSession({
          id: 'row-mine',
          sessionId: 'sess-mine',
          userId: 'user-viewer-9',
          branch: 'user/mine',
        }),
      ],
      'user-viewer-9',
      { name: 'Ada Lovelace', avatarUrl: 'https://example.com/ada.png' },
    );

    const { client } = renderSection();
    await waitForMutationsIdle(client);
    await showAllOwners();
    const user = userEvent.setup();

    const mine = await screen.findByRole('link', { name: 'mine' });
    const other = screen.getByRole('link', { name: 'alpha' });
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();

    await user.hover(mine);
    const mineCard = await screen.findByLabelText('mine session details');
    expect(within(mineCard).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(mineCard).getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
      'src',
      'https://example.com/ada.png',
    );

    await user.hover(other);
    const otherCard = await screen.findByLabelText('alpha session details');
    expect(within(otherCard).getByText('Grace Hopper')).toBeInTheDocument();
    expect(within(otherCard).getByRole('img', { name: 'Grace Hopper' })).toHaveAttribute(
      'src',
      'https://example.com/grace.png',
    );
  });

  it('offers delete only on the viewer-owned session', async () => {
    stubSessions(
      [
        userSession({ id: 'row-other', sessionId: 'sess-other', userId: 'user-owner-1', branch: 'user/alpha' }),
        userSession({ id: 'row-mine', sessionId: 'sess-mine', userId: 'user-viewer-9', branch: 'user/mine' }),
      ],
      'user-viewer-9',
    );

    const { client } = renderSection();
    await waitForMutationsIdle(client);
    await showAllOwners();
    const user = userEvent.setup();

    const other = await screen.findByRole('link', { name: 'alpha' });
    await user.hover(other);
    const card = await screen.findByLabelText('alpha session details');
    expect(within(card).getByText('user-owner-1')).toBeInTheDocument();
    await user.unhover(other);

    await user.click(screen.getByRole('button', { name: 'Session actions for alpha' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Session actions for mine' }));
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });
});
