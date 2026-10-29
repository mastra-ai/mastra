import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { act, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatConnectionContext } from '../../context/ChatConnectionContext';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import type { ConnectionStatus } from '../../hooks/useAgentControllerConnection';
import { Composer } from '../Composer';
import { FACTORY_ID, SESSION_ID, releaseSession, stubPreparingSession } from './composer-session-test-fixture';

function ComposerOnConnection({ status }: { status: ConnectionStatus }) {
  return (
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <SidebarProvider storageKey="connection-ring-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <ChatConnectionContext.Provider value={{ status }}>
                    <Composer />
                  </ChatConnectionContext.Provider>
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </SidebarProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('Composer working ring during connection drops', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps working through a brief drop and pauses only while the reconnect notice shows', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const view = renderWithProviders(<ComposerOnConnection status="ready" />);
    await releaseSession(session.finishWorkspace, view.client);
    await session.emit({ type: 'agent_start' });

    const ring = () => view.container.querySelector('[data-slot="composer-ring"]');
    await waitFor(() => expect(ring()).toHaveAttribute('data-busy', 'true'));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const advance = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds));

    view.rerender(<ComposerOnConnection status="reconnecting" />);
    advance(250);
    expect(ring()).toHaveAttribute('data-busy', 'true');
    view.rerender(<ComposerOnConnection status="ready" />);
    advance(3_000);
    expect(ring()).toHaveAttribute('data-busy', 'true');

    view.rerender(<ComposerOnConnection status="reconnecting" />);
    advance(300);
    expect(screen.getByText('Reconnecting…')).toBeVisible();
    expect(ring()).toHaveAttribute('data-busy', 'false');

    view.rerender(<ComposerOnConnection status="ready" />);
    expect(screen.getByText('Reconnected')).toBeVisible();
    expect(ring()).toHaveAttribute('data-busy', 'true');
  });
});
