import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import type { FactoryUserSession } from '../../services/user-sessions';
import { UserSessionsSection } from '../UserSessionsSection';

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

describe('user session attribution', () => {
  it("sorts the viewer's own sessions first and marks sessions owned by others", async () => {
    // The server lists the other user's org-visible session before the
    // viewer's own; the sidebar must re-order and attribute it.
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
    const user = userEvent.setup();

    const mine = await screen.findByRole('button', { name: 'mine' });
    const other = screen.getByRole('button', { name: 'alpha' });
    const labels = screen
      .getAllByRole('button')
      .map(button => button.getAttribute('aria-label'))
      .filter(label => label === 'mine' || label === 'alpha');
    expect(labels).toEqual(['mine', 'alpha']);
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
    // The DELETE route is owner-only and 404s for non-owners, and the delete
    // service treats 404 as an idempotent success, so a non-owned row must not
    // offer a delete action that would fake-succeed.
    stubSessions(
      [
        userSession({ id: 'row-other', sessionId: 'sess-other', userId: 'user-owner-1', branch: 'user/alpha' }),
        userSession({ id: 'row-mine', sessionId: 'sess-mine', userId: 'user-viewer-9', branch: 'user/mine' }),
      ],
      'user-viewer-9',
    );

    const { client } = renderSection();
    await waitForMutationsIdle(client);
    const user = userEvent.setup();

    const other = await screen.findByRole('button', { name: 'alpha' });
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
