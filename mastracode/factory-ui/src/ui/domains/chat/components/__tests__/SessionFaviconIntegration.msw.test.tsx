import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatMessageBoundary } from '../../context/ChatSessionProvider';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import { FACTORY_ID, SESSION_ID, stubPreparingSession } from './composer-session-test-fixture';

function faviconHref() {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.getAttribute('href');
}

// `deferUntilMessagesReady={false}` mirrors `ThreadPage`: the transcript provider
// stays mounted through preparation, where a second favicon writer used to fight it.
function renderThread() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <MainSidebarProvider storageKey="favicon-integration-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <ChatMessageBoundary>
                    <div data-testid="thread-body">ready</div>
                  </ChatMessageBoundary>
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </MainSidebarProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/mastra.svg">';
});

describe('Session favicon tracks the session lifecycle', () => {
  describe('when the session prepare stepper is showing', () => {
    it('shows the purple initializing indicator', async () => {
      const session = stubPreparingSession();
      const { client } = renderThread();

      await waitFor(() => expect(screen.getByTestId('session-prepare-steps')).toBeInTheDocument());
      expect(faviconHref()).toBe('/favicon-session-initializing.svg');

      session.finishWorkspace();
      await waitForMutationsIdle(client);
    });
  });

  describe('when the workspace is ready and the agent is idle', () => {
    it('flips to the blue awaiting-user indicator', async () => {
      const session = stubPreparingSession();
      const { client } = renderThread();

      session.finishWorkspace();
      await waitForMutationsIdle(client);
      await waitFor(() => expect(screen.getByTestId('thread-body')).toBeInTheDocument());

      expect(screen.queryByTestId('session-prepare-steps')).not.toBeInTheDocument();
      await waitFor(() => expect(faviconHref()).toBe('/favicon-session-awaiting.svg'));
    });
  });

  describe('when the thread history fails to load', () => {
    it('shows the red error indicator alongside the failure notice', async () => {
      const session = stubPreparingSession();
      server.use(
        http.get(
          `${TEST_BASE_URL}/api/agent-controller/code/sessions/:resourceId/threads/:threadId/messages`,
          () => new HttpResponse(null, { status: 500 }),
        ),
      );
      const { client } = renderThread();

      session.finishWorkspace();
      await waitForMutationsIdle(client);

      expect(await screen.findByText(/Failed to load messages/)).toBeInTheDocument();
      await waitFor(() => expect(faviconHref()).toBe('/favicon-session-error.svg'));
    });
  });
});
