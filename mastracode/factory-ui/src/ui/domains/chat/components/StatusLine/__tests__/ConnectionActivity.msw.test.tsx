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
import { useComposerConnectionNotice } from '../../../hooks/useComposerConnectionNotice';
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
            <ComposerHeader open={notice.open}>
              <ComposerConnectionNotice notice={notice.notice} />
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

  it.each([
    ['reconnecting', 'Reconnecting…'],
    ['error', 'Connection lost. Check the server and reload to reconnect.'],
  ] as const)('given the %s stream while the agent runs, then it outranks the working state', (status, label) => {
    const view = renderWithProviders(<ActivityFixture status={status} busy />);
    advance(300);

    expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByText('Working…')).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);

    view.rerender(<ActivityFixture status="ready" busy />);

    expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(screen.getByText('Reconnected')).toBeVisible();
    expect(screen.getByText('Working…')).toBeInTheDocument();

    advance(1_999);
    expect(screen.getByText('Reconnected')).toBeVisible();
    advance(1);
    expect(screen.queryByText('Reconnected')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Working…');
  });

  it('hides brief connection blips without flashing a recovery confirmation', () => {
    const view = renderWithProviders(<ActivityFixture status="ready" busy={false} />);
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(<ActivityFixture status="reconnecting" busy={false} />);
    advance(250);
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    advance(3_000);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the notice open through repeated drops and restarts the recovery confirmation', () => {
    const view = renderWithProviders(<ActivityFixture status="reconnecting" busy={false} />);
    advance(300);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    advance(1_900);
    view.rerender(<ActivityFixture status="reconnecting" busy={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    advance(2_100);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    advance(1_999);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnected');
    advance(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a failed connection immediately and keeps the guidance until recovery', () => {
    const view = renderWithProviders(<ActivityFixture status="ready" busy={false} />);
    view.rerender(<ActivityFixture status="error" busy={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost.');
    advance(10_000);
    expect(screen.getByRole('status')).toHaveTextContent('Connection lost.');
    view.rerender(<ActivityFixture status="ready" busy={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconnected');
    advance(2_000);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cancels pending notices when leaving a session', () => {
    const view = renderWithProviders(<ActivityFixture status="reconnecting" busy={false} />);
    advance(100);
    view.unmount();
    renderWithProviders(<ActivityFixture status="connecting" busy={false} />);
    advance(5_000);
    expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconnected')).not.toBeInTheDocument();
  });
});
