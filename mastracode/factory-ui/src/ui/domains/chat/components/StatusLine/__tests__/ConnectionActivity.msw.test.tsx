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
  sandboxProgress: undefined,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'factory',
};

function renderActivity(status: ChatConnectionApi['status'], busy: boolean) {
  const transcript: ChatTranscriptApi = {
    transcript: initialTranscript,
    busy,
    localUser: vi.fn(),
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
  it('given the stream drops while the agent runs, then the status line still shows the reconnect', () => {
    renderActivity('reconnecting', true);

    expect(screen.getByText('Reconnecting…')).toBeVisible();
  });

  it('given the connection is lost for good, then the status line says so instead of Working', () => {
    renderActivity('error', true);

    expect(screen.getByText('Disconnected')).toBeVisible();
    expect(screen.queryByText('Working…')).toBeNull();
  });
});
