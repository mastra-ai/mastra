/**
 * BDD coverage for `ModesSelection`, the status-line mode selector. While the
 * route points at a thread the controller has not bound yet, the selector must
 * not show — or mutate — the previous thread's mode.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../../e2e/web-ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import { ChatModesContext } from '../../../context/ChatModesContext';
import type { ChatModesApi } from '../../../context/ChatModesContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import { ModesSelection } from '../ModesSelection';

const MODES = [
  { id: 'build', name: 'Build' },
  { id: 'plan', name: 'Plan' },
];

function renderModesSelection({
  activeThreadId = 'thread-a',
  routeThreadId = 'thread-a',
  setMode = () => Promise.resolve(),
}: {
  activeThreadId?: string;
  routeThreadId?: string;
  setMode?: ChatModesApi['setMode'];
} = {}) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/threads/${routeThreadId}`]}>
      <Routes>
        <Route
          path="/threads/:threadId"
          element={
            <ChatSessionContext.Provider
              value={{
                resourceId: 'resource-modes',
                sessionEnabled: true,
                resourceEnabled: true,
                baseUrl: TEST_BASE_URL,
                kind: 'user',
              }}
            >
              <ChatConnectionContext.Provider value={{ status: 'ready', threadId: activeThreadId }}>
                <ChatModesContext.Provider
                  value={{
                    modes: MODES,
                    activeMode: MODES[0],
                    activeModeId: 'build',
                    isSwitchingMode: false,
                    setMode,
                  }}
                >
                  <ModesSelection />
                </ChatModesContext.Provider>
              </ChatConnectionContext.Provider>
            </ChatSessionContext.Provider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ModesSelection', () => {
  describe('given the route changed before the controller bound the new thread', () => {
    it("replaces the selector with a skeleton so the previous thread's mode is neither shown nor mutable", () => {
      const setMode = vi.fn(() => Promise.resolve());
      renderModesSelection({ activeThreadId: 'thread-a', routeThreadId: 'thread-b', setMode });

      expect(screen.getByLabelText('Loading mode')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Session mode' })).not.toBeInTheDocument();
      expect(screen.queryByText('Build')).not.toBeInTheDocument();
      expect(setMode).not.toHaveBeenCalled();
    });
  });

  describe('given the controller is bound to the route thread', () => {
    it('renders the active mode selector', () => {
      renderModesSelection();

      expect(screen.getByRole('combobox', { name: 'Session mode' })).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
      expect(screen.queryByLabelText('Loading mode')).not.toBeInTheDocument();
    });
  });
});
