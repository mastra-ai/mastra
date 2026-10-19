import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/ui/render';
import type { SessionModelCatalog } from '../../../../../../hooks/useSessionModelCatalog';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import { PayingAccount } from '../PayingAccount';

const SHANE = { id: 'user-shane', name: 'Shane Thomas' };

function renderPayingAccount({
  viewerId = 'user-damien',
  owner,
  draft = false,
  projectScope = 'hybrid',
  threadScope,
  authEnabled = true,
}: {
  viewerId?: string;
  owner?: ChatSessionContextApi['owner'];
  draft?: boolean;
  projectScope?: 'factory' | 'user' | 'hybrid';
  threadScope?: SessionModelCatalog['modelScope'];
  authEnabled?: boolean;
}) {
  const catalog: SessionModelCatalog = { models: [], modelScope: threadScope, defaultModelId: null };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      authEnabled
        ? HttpResponse.json({ authenticated: true, user: { userId: viewerId, organizationId: 'org-1' } })
        : HttpResponse.json({ error: 'not_found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: projectScope } }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () => HttpResponse.json(catalog)),
  );
  const session: ChatSessionContextApi = {
    resourceId: 'session-1',
    sessionThreadId: 'session-1',
    draftSessionId: draft ? 'draft-1' : undefined,
    sessionEnabled: true,
    resourceReady: true,
    sandboxReady: true,
    sandboxPreparing: false,
    resourceEnabled: true,
    baseUrl: TEST_BASE_URL,
    kind: 'user',
    owner,
  };
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/work']}>
      <Routes>
        <Route
          path="/factories/:factoryId/*"
          element={
            <ChatSessionContext.Provider value={session}>
              <PayingAccount />
            </ChatSessionContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PayingAccount', () => {
  it('names the owner when a teammate opens a session that runs on the owner’s credentials', async () => {
    renderPayingAccount({ owner: SHANE, threadScope: 'user' });

    expect(await screen.findByText('Shane Thomas’s account')).toBeInTheDocument();
  });

  it('tells the owner the session runs on their own account', async () => {
    renderPayingAccount({ viewerId: SHANE.id, owner: SHANE, threadScope: 'user' });

    expect(await screen.findByText('Your account')).toBeInTheDocument();
  });

  it('says the organization pays for a work-item thread even in a hybrid Factory', async () => {
    renderPayingAccount({ owner: SHANE, threadScope: 'factory' });

    expect(await screen.findByText('Organization account')).toBeInTheDocument();
  });

  it('says a new chat in a hybrid Factory runs on your account before the first message', async () => {
    renderPayingAccount({ draft: true, projectScope: 'hybrid' });

    expect(await screen.findByText('Your account')).toBeInTheDocument();
  });

  it('says a new chat in an organization-scoped Factory runs on the organization account', async () => {
    renderPayingAccount({ draft: true, projectScope: 'factory' });

    expect(await screen.findByText('Organization account')).toBeInTheDocument();
  });

  it('stays hidden on a local Factory without sign-in, where only your own credentials exist', async () => {
    const authAnswered = new Promise<void>(resolve => {
      server.events.on('response:mocked', ({ request }) => {
        if (request.url.endsWith('/auth/me')) resolve();
      });
    });
    renderPayingAccount({ draft: true, projectScope: 'factory', authEnabled: false });

    await authAnswered;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByText(/account$/)).not.toBeInTheDocument();
  });
});
