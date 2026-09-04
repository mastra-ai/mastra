import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import type { ChatConnectionApi } from '../../../context/ChatConnectionContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ChatTranscriptContext } from '../../../context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../../context/ChatTranscriptContext';
import { initialTranscript } from '../../../services/transcript';
import { ConnectionActivity } from '../ConnectionActivity';

const session: ChatSessionContextApi = {
  resourceId: 'session-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'factory',
};

function renderActivity(status: ChatConnectionApi['status'], busy: boolean) {
  const transcript: ChatTranscriptApi = {
    transcript: initialTranscript,
    busy,
    phase: busy ? 'working' : 'awaiting',
    initializing: false,
    historyInitializing: false,
    initialHistoryReady: true,
    localUser: vi.fn(),
    failLocalUser: vi.fn(),
    reset: vi.fn(),
    resolvePrompt: vi.fn(),
    clearPending: vi.fn(),
    pushNotice: vi.fn(),
    loadMore: { hasMore: false, isLoading: false },
  };
  return renderWithProviders(
    <MemoryRouter>
      <ChatSessionContext.Provider value={session}>
        <ChatConnectionContext.Provider value={{ status }}>
          <ChatTranscriptContext.Provider value={transcript}>
            <ConnectionActivity />
          </ChatTranscriptContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('ConnectionActivity', () => {
  it.each([
    ['reconnecting', 'Reconnecting…'],
    ['error', 'Disconnected'],
  ] as const)('given the %s stream while the agent runs, then it outranks the working state', (status, label) => {
    renderActivity(status, true);

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByText('Working…')).toBeNull();
  });
});
