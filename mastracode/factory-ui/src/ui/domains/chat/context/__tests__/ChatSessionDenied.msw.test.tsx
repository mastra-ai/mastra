import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from '../../components/__tests__/composer-session-test-fixture';
import { ChatMessageBoundary } from '../ChatSessionProvider';
import { ChatSessionTestProvider } from '../ChatSessionTestProvider';

function renderDeniedSession() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
              <ChatMessageBoundary>
                <div data-testid="chat-content">ready</div>
              </ChatMessageBoundary>
            </ChatSessionTestProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('denied or missing session', () => {
  it('renders the error state instead of the perpetual preparing loader', async () => {
    stubPreparingSession({ materialized: true });
    // The server returns the same 404 for a missing session and a private one
    // owned by someone else; the page must surface it, not spin forever.
    server.use(
      http.get(`${TEST_BASE_URL}/web/user-sessions/:sessionId`, () =>
        HttpResponse.json({ error: 'Session not found' }, { status: 404 }),
      ),
    );

    renderDeniedSession();

    expect(await screen.findByText('This session was not found or is private to another user.')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-content')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
