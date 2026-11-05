import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from '../../components/__tests__/composer-session-test-fixture';
import { ChatSessionConfigProvider } from '../ChatSessionProvider';
import { useChatSessionContext } from '../useChatSessionContext';

function SessionAddress() {
  const { resourceId, threadTags } = useChatSessionContext();
  return <output aria-label="session address">{JSON.stringify({ resourceId, threadTags: threadTags ?? null })}</output>;
}

function renderSession(resourceId: string) {
  stubPreparingSession({ materialized: true });
  server.use(
    http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
      HttpResponse.json({
        session: {
          id: 'row-1',
          sessionId: SESSION_ID,
          resourceId,
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'user/session-1',
          baseBranch: 'main',
          materializedAt: '2026-07-23T00:00:00.000Z',
          createdAt: '2026-07-23T00:00:00.000Z',
          updatedAt: '2026-07-23T00:00:00.000Z',
        },
      }),
    ),
  );
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <ChatSessionConfigProvider threadId={SESSION_ID} userScoped>
              <SessionAddress />
            </ChatSessionConfigProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('session thread tags', () => {
  it("lists a session's threads by its stamp when it shares its owner's memory resource", async () => {
    renderSession('user-1');

    await waitFor(() =>
      expect(screen.getByLabelText('session address')).toHaveTextContent(
        JSON.stringify({ resourceId: 'user-1', threadTags: { factorySessionId: SESSION_ID } }),
      ),
    );
  });

  it('lists every thread of a session still on a resource of its own, stamped or not', async () => {
    renderSession(SESSION_ID);

    await waitFor(() =>
      expect(screen.getByLabelText('session address')).toHaveTextContent(
        JSON.stringify({ resourceId: SESSION_ID, threadTags: null }),
      ),
    );
  });
});
