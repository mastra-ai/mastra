import { ComposerHeader } from '@mastra/playground-ui/components/Composer';
import { act, cleanup, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import { ChatConnectionContext } from '../../../context/ChatConnectionContext';
import type { ChatConnectionApi } from '../../../context/ChatConnectionContext';
import { ChatSessionContext } from '../../../context/ChatSessionContext';
import type { ChatSessionContextApi } from '../../../context/ChatSessionContext';
import { ChatTranscriptContext } from '../../../context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../../context/ChatTranscriptContext';
import { RECONNECT_NOTICE_DELAY_MS, useComposerConnectionNotice } from '../../../hooks/useComposerConnectionNotice';
import { initialTranscript } from '../../../services/transcript';
import { ComposerConnectionNotice } from '../../ComposerConnectionNotice';
import { ConnectionActivity } from '../ConnectionActivity';

const session: ChatSessionContextApi = {
  sessionId: 'session-1',
  resourceId: 'user-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  resourceEnabled: true,
  baseUrl: TEST_BASE_URL,
  kind: 'factory',
};

function ActivityFixture({ status, busy }: { status: ChatConnectionApi['status']; busy: boolean }) {
  const notice = useComposerConnectionNotice(status);
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
  return (
    <MemoryRouter>
      <ChatSessionContext.Provider value={session}>
        <ChatConnectionContext.Provider value={{ status }}>
          <ChatTranscriptContext.Provider value={transcript}>
            <ComposerHeader open={notice !== undefined}>
              {notice && <ComposerConnectionNotice notice={notice} />}
            </ComposerHeader>
            <ConnectionActivity />
          </ChatTranscriptContext.Provider>
        </ChatConnectionContext.Provider>
      </ChatSessionContext.Provider>
    </MemoryRouter>
  );
}

describe('ConnectionActivity', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function advance(milliseconds: number) {
    act(() => vi.advanceTimersByTime(milliseconds));
  }

  it('given a reconnect that outlasts the delay, then a quiet status-line hint outranks the working state', () => {
    const view = renderWithProviders(<ActivityFixture status="reconnecting" busy />);
    advance(RECONNECT_NOTICE_DELAY_MS);

    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    expect(screen.queryByText('Working…')).toBeNull();
    expect(screen.queryByText(/Connection lost/)).toBeNull();

    view.rerender(<ActivityFixture status="ready" busy />);

    // Recovery clears the hint without a confirmation flash.
    expect(screen.queryByText('Reconnecting…')).toBeNull();
    expect(screen.queryByText('Reconnected')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Working…');
  });

  it('hides connection blips shorter than the delay', () => {
    const view = renderWithProviders(<ActivityFixture status="ready" busy={false} />);
    view.rerender(<ActivityFixture status="reconnecting" busy={false} />);
    advance(RECONNECT_NOTICE_DELAY_MS - 1);
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    advance(5_000);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('restarts the delay for each new drop', () => {
    const view = renderWithProviders(<ActivityFixture status="reconnecting" busy={false} />);
    advance(RECONNECT_NOTICE_DELAY_MS);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(<ActivityFixture status="reconnecting" busy={false} />);
    advance(RECONNECT_NOTICE_DELAY_MS - 1);
    expect(screen.queryByRole('status')).toBeNull();
    advance(1);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
  });

  it('shows a failed connection immediately in the header and clears it on recovery', () => {
    const view = renderWithProviders(<ActivityFixture status="ready" busy={false} />);
    view.rerender(<ActivityFixture status="error" busy={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost.');
    advance(10_000);
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost.');
    expect(screen.queryByText('Reconnecting…')).toBeNull();
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    expect(screen.queryByText('Reconnected')).toBeNull();
    expect(screen.queryByText(/Connection lost/)).toBeNull();
  });

  it('cancels a pending notice when leaving a session', () => {
    const view = renderWithProviders(<ActivityFixture status="reconnecting" busy={false} />);
    advance(100);
    view.unmount();
    renderWithProviders(<ActivityFixture status="connecting" busy={false} />);
    advance(5_000);
    expect(screen.queryByText('Reconnecting…')).toBeNull();
  });
});
