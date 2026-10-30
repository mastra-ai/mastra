import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import {
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@mastra/playground-ui/components/MessageScroller';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { OverlaysProvider } from '../../../../lib/overlays';
import { ChatSessionTestProvider } from '../../context/ChatSessionTestProvider';
import { Composer } from '../Composer';
import {
  FACTORY_ID,
  SESSION_ID,
  releaseSession,
  renderThread,
  stubPreparingSession,
} from './composer-session-test-fixture';

const MESSAGE = 'Use the platform token, then continue';

async function renderActiveRun() {
  const session = stubPreparingSession({ autoAgentEnd: false });
  const { client } = renderThread();
  await releaseSession(session.finishWorkspace, client);
  await session.emit({ type: 'agent_start' });
  await screen.findByRole('button', { name: 'Abort' });
  return { session, client };
}

describe('Composer steering', () => {
  describe('when a run is active', () => {
    it('replaces abort with send while drafting and restores abort after sending', async () => {
      const session = stubPreparingSession({ autoAgentEnd: false });
      const user = userEvent.setup();
      const { client } = renderThread();
      await releaseSession(session.finishWorkspace, client);

      expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();

      await session.emit({ type: 'agent_start' });
      await screen.findByRole('button', { name: 'Abort' });
      expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();

      const composer = screen.getByRole('textbox', { name: 'Message' });
      await user.type(composer, '   ');
      expect(screen.getByRole('button', { name: 'Abort' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();

      await user.type(composer, MESSAGE);
      expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => expect(session.delivered).toEqual([MESSAGE]));
      expect(screen.getByRole('button', { name: 'Abort' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();

      await user.type(composer, MESSAGE);
      await user.clear(composer);
      expect(screen.getByRole('button', { name: 'Abort' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();

      await session.emit({ type: 'agent_end' });
      expect(await screen.findByRole('button', { name: 'Send message' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Abort' })).not.toBeInTheDocument();
    });

    it('does not abort the run when Send is double-clicked', async () => {
      const user = userEvent.setup();
      const { session, client } = await renderActiveRun();

      await user.type(screen.getByRole('textbox', { name: 'Message' }), MESSAGE);
      await user.dblClick(screen.getByRole('button', { name: 'Send message' }));
      await waitFor(() => expect(session.delivered).toEqual([MESSAGE]));
      await waitForMutationsIdle(client);

      expect(session.abortRequests).toBe(0);
    });

    it('aborts the run when Abort is clicked', async () => {
      const user = userEvent.setup();
      const { session } = await renderActiveRun();

      await user.click(screen.getByRole('button', { name: 'Abort' }));

      await waitFor(() => expect(session.abortRequests).toBe(1));
    });

    it('keeps Abort while the draft holds only images, which steering cannot send', async () => {
      const user = userEvent.setup();
      await renderActiveRun();

      await user.upload(screen.getByLabelText('Attach images'), new File(['png'], 'shot.png', { type: 'image/png' }));

      expect(await screen.findByRole('button', { name: 'Remove shot.png' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abort' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    });
  });

  it('queues the message without interrupting the active run and confirms its delivery', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);
    await session.emit({ type: 'agent_start' });

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));
    await user.type(composer, MESSAGE);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(session.delivered).toEqual([MESSAGE]));
    await waitForMutationsIdle(client);
    expect(session.steerAttempts).toBe(0);
    expect(screen.getByText('Steering…')).toBeInTheDocument();
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);

    const createdAt = new Date('2026-08-20T10:00:00.000Z');
    await session.emit({
      type: 'message_start',
      message: {
        id: 'signal-steer',
        role: 'signal',
        createdAt,
        content: {
          format: 2,
          parts: [{ type: 'text', text: MESSAGE }],
          metadata: {
            signal: {
              id: 'signal-steer',
              type: 'user',
              tagName: 'user',
              contents: MESSAGE,
              createdAt: createdAt.toISOString(),
              attributes: { delivery: 'while-active' },
            },
          },
        },
      },
    });

    expect(await screen.findByText('Steered message')).toBeInTheDocument();
    expect(screen.queryByText('Steering…')).not.toBeInTheDocument();
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);
  });

  it('marks a rejected steering message as not sent', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false, failDispatch: true });
    const user = userEvent.setup();
    const { client } = renderThread();
    await releaseSession(session.finishWorkspace, client);
    await session.emit({ type: 'agent_start' });

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));
    await user.type(composer, MESSAGE);
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Not sent')).toBeInTheDocument();
    await waitForMutationsIdle(client);
    expect(screen.queryByText('Steering…')).not.toBeInTheDocument();
    expect(screen.getAllByText(MESSAGE)).toHaveLength(1);
    expect(screen.getByText(/Sandbox is gone/)).toBeInTheDocument();
    expect(session.delivered).toEqual([]);
    expect(session.steerAttempts).toBe(0);
  });
});

function renderSteerScroller() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/user/threads/${SESSION_ID}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/user/threads/:threadId"
          element={
            <SidebarProvider storageKey="steer-scroll-test">
              <ChatSessionTestProvider threadId={SESSION_ID} userScoped deferUntilMessagesReady={false}>
                <OverlaysProvider>
                  <MessageScrollerProvider autoScroll>
                    <MessageScrollerViewport data-testid="steer-viewport">
                      <MessageScrollerContent />
                      <Composer />
                    </MessageScrollerViewport>
                  </MessageScrollerProvider>
                </OverlaysProvider>
              </ChatSessionTestProvider>
            </SidebarProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const setScrollMetrics = (
  element: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: metrics.clientHeight });
  element.scrollTop = metrics.scrollTop;
};

describe('Composer steering scroll', () => {
  it('carries a reader who scrolled away back to the live end when they steer', async () => {
    const session = stubPreparingSession({ autoAgentEnd: false });
    const user = userEvent.setup();
    const { client } = renderSteerScroller();
    await releaseSession(session.finishWorkspace, client);
    await session.emit({ type: 'agent_start' });

    const composer = await screen.findByRole('textbox', { name: 'Message' });
    await waitFor(() => expect(composer).toHaveAttribute('placeholder', 'Steer the agent…'));

    const viewport = screen.getByTestId('steer-viewport');
    const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && typeof options.top === 'number') viewport.scrollTop = options.top;
    });
    viewport.scrollTo = scrollTo;
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    fireEvent.scroll(viewport);

    await user.type(composer, MESSAGE);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: 'smooth' }));
    await waitForMutationsIdle(client);
  });
});
