import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
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
      const session = stubPreparingSession({ ensurePending: true });
      renderThread();

      await waitFor(() => expect(screen.getByTestId('session-prepare-steps')).toBeInTheDocument());
      expect(faviconHref()).toBe('/favicon-session-initializing.svg');

      session.finishEnsure();
      session.finishWorkspace();
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
});
