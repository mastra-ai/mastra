import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionContext } from '../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../context/ChatSessionContext';
import { ProviderLoginAction } from '../ProviderLoginAction';

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

describe('ProviderLoginAction', () => {
  it.each([
    { modelScope: 'factory', href: '/factories/factory-1/settings/models#factory-defaults' },
    { modelScope: 'user', href: '/factories/factory-1/settings/models#personal-defaults' },
  ] as const)('links a $modelScope-scoped session to $href', async ({ modelScope, href }) => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/factory-1`, () =>
        HttpResponse.json({ project: { id: 'factory-1', modelScope: 'hybrid' } }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/models`, () =>
        HttpResponse.json({ models: [], modelScope, defaultModelId: null }),
      ),
    );

    renderWithProviders(
      <MemoryRouter initialEntries={['/factories/factory-1/sessions/session-1']}>
        <ChatSessionContext.Provider value={liveSession}>
          <ProviderLoginAction />
        </ChatSessionContext.Provider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Login' })).toHaveAttribute('href', href);
  });
});
