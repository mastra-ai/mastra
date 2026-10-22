import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { ProviderReconnectAction } from '../ProviderReconnectAction';

const VIEWER_ID = 'user-1';
const ward = { id: 'user-2', name: 'Ward Peeters' };

const liveSession: ChatSessionContextApi = {
  sessionId: 'session-1',
  resourceId: 'user-1',
  sessionThreadId: 'thread-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'user',
  draftSessionId: undefined,
  factorySessionState: { factoryProjectId: 'factory-1', projectRepositoryId: 'repository-1' },
};

function serveSession(modelScope: 'factory' | 'user') {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: VIEWER_ID } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
      HttpResponse.json({ project: { id: 'factory-1', modelScope: 'hybrid' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({ models: [], modelScope, defaultModelId: null }),
    ),
  );
}

function renderAction(session: ChatSessionContextApi) {
  renderWithProviders(
    <MemoryRouter initialEntries={['/factories/factory-1/sessions/session-1']}>
      <ChatSessionContext.Provider value={session}>
        <ProviderReconnectAction />
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('ProviderReconnectAction', () => {
  it.each([
    { modelScope: 'factory', ownedBy: 'nobody', owner: undefined, href: '/factories/factory-1/settings/models' },
    { modelScope: 'factory', ownedBy: 'a teammate', owner: ward, href: '/factories/factory-1/settings/models' },
    { modelScope: 'user', ownedBy: 'nobody', owner: undefined, href: '/factories/factory-1/settings/personal-models' },
    {
      modelScope: 'user',
      ownedBy: 'the viewer',
      owner: { id: VIEWER_ID },
      href: '/factories/factory-1/settings/personal-models',
    },
  ] as const)('links a $modelScope-scoped session owned by $ownedBy to $href', async ({ modelScope, owner, href }) => {
    serveSession(modelScope);
    renderAction({ ...liveSession, owner });

    expect(await screen.findByRole('link', { name: 'Login' })).toHaveAttribute('href', href);
  });

  it('names the teammate whose connection a personal-credential session runs on', async () => {
    serveSession('user');
    renderAction({ ...liveSession, owner: ward });

    expect(await screen.findByText('Ward Peeters needs to reconnect')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  });
});
