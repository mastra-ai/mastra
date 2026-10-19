import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

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
  const submitComposer = vi.fn((event: React.FormEvent) => event.preventDefault());
  const view = renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/work']}>
      <Routes>
        <Route
          path="/factories/:factoryId/*"
          element={
            <ChatSessionContext.Provider value={session}>
              <form onSubmit={submitComposer}>
                <PayingAccount />
              </form>
            </ChatSessionContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return { ...view, submitComposer };
}

const findPayer = (holder: string) => screen.findByRole('button', { name: `${holder} account pays for replies` });

describe('PayingAccount', () => {
  it('names the owner when a teammate opens a session that runs on the owner’s credentials', async () => {
    renderPayingAccount({ owner: SHANE, threadScope: 'user' });

    expect(await findPayer('Shane Thomas’s')).toBeInTheDocument();
  });

  it('tells the owner the session runs on their own account', async () => {
    renderPayingAccount({ viewerId: SHANE.id, owner: SHANE, threadScope: 'user' });

    expect(await findPayer('Your')).toBeInTheDocument();
  });

  it('says the organization pays for a work-item thread even in a hybrid Factory', async () => {
    renderPayingAccount({ owner: SHANE, threadScope: 'factory' });

    expect(await findPayer('Organization')).toBeInTheDocument();
  });

  it('says a new chat in a hybrid Factory runs on your account before the first message', async () => {
    renderPayingAccount({ draft: true, projectScope: 'hybrid' });

    expect(await findPayer('Your')).toBeInTheDocument();
  });

  it('says a new chat in an organization-scoped Factory runs on the organization account', async () => {
    renderPayingAccount({ draft: true, projectScope: 'factory' });

    expect(await findPayer('Organization')).toBeInTheDocument();
  });

  it('does not send the draft when someone clicks the account icon inside the composer form', async () => {
    const { submitComposer } = renderPayingAccount({ owner: SHANE, threadScope: 'user' });

    await userEvent.click(await findPayer('Shane Thomas’s'));

    expect(submitComposer).not.toHaveBeenCalled();
  });

  it('stays hidden on a local Factory without sign-in, where only your own credentials exist', async () => {
    const { client } = renderPayingAccount({ draft: true, projectScope: 'factory', authEnabled: false });

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.queryByRole('button', { name: /pays for replies$/ })).not.toBeInTheDocument();
  });
});
