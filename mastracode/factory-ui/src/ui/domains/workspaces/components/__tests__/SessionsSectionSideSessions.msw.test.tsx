import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../../chat/context/ChatSessionContext';
import type { FactoryUserSession } from '../../services/user-sessions';
import { SessionsSection } from '../SessionsSection';
import { stubSessionsFactory, testChatSession } from './fixtures/sessionsSection';

const projectRepositoryId = 'ghp-1';

function userSession(
  sessionId: string,
  title: string,
  createdAt: string,
  originSessionId: string | null = null,
): FactoryUserSession {
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
    originSessionId,
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

const sessions = [
  userSession('origin', 'Origin session', '2026-07-23T04:00:00.000Z'),
  userSession('side-1', 'First side session', '2026-07-23T03:00:00.000Z', 'origin'),
  userSession('side-2', 'Second side session', '2026-07-23T02:00:00.000Z', 'origin'),
  userSession('other', 'Unrelated session', '2026-07-23T01:00:00.000Z'),
];

function renderSection(path = '/factories/fp-1') {
  stubSessionsFactory('fp-1', [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryId/sessions`, () => HttpResponse.json({ sessions })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/work-items`, () => HttpResponse.json({ items: [] })),
  );
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <ChatSessionContext.Provider value={testChatSession('fp-1', projectRepositoryId)}>
        <Routes>
          <Route path="/factories/:factoryId" element={<SessionsSection />} />
          <Route path="/factories/:factoryId/user/threads/:sessionId" element={<SessionsSection />} />
        </Routes>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

const sessionLinkNames = () =>
  within(screen.getByRole('region', { name: 'Sessions' }))
    .getAllByRole('link')
    .map(link => link.getAttribute('aria-label'));

describe('Sessions sidebar side sessions', () => {
  beforeEach(() => {
    localStorage.removeItem('mastracode.pinnedSessions');
  });

  it('folds side sessions under their origin until its chevron expands them', async () => {
    const user = userEvent.setup();
    renderSection();

    const origin = await screen.findByRole('link', { name: 'Origin session' });
    expect(origin).toHaveAttribute('href', '/factories/fp-1/user/threads/origin');
    expect(sessionLinkNames()).toEqual(['Origin session', 'Unrelated session']);

    const toggle = screen.getByRole('button', { name: '2 side sessions of Origin session' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /side sessions? of Unrelated session/ })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(sessionLinkNames()).toEqual([
      'Origin session',
      'First side session',
      'Second side session',
      'Unrelated session',
    ]);
    expect(screen.getByRole('link', { name: 'First side session' })).toHaveAttribute(
      'href',
      '/factories/fp-1/user/threads/side-1',
    );
    // Expanding does not navigate: the origin row stays a plain link to its own session.
    expect(origin).not.toHaveAttribute('aria-current');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(sessionLinkNames()).toEqual(['Origin session', 'Unrelated session']);
  });

  it('opens the side sessions when one of them is the open session', async () => {
    renderSection('/factories/fp-1/user/threads/side-2');

    const open = await screen.findByRole('link', { name: 'Second side session' });
    expect(open).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '2 side sessions of Origin session' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
