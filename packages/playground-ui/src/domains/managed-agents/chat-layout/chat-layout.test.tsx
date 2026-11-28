// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatLayout } from './chat-layout';

let mobile = false;

beforeEach(() => {
  mobile = false;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile && query.includes('max-width'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(cleanup);

function renderLayout(detailsOpen: boolean) {
  return render(
    <ChatLayout
      threads={<nav aria-label="Threads">Threads</nav>}
      details={<aside aria-label="Details">Details</aside>}
      detailsOpen={detailsOpen}
      onDetailsOpenChange={() => undefined}
    >
      <p>Conversation</p>
    </ChatLayout>,
  );
}

function DefaultThreadsLayout() {
  const [threadsOpen, setThreadsOpen] = useState<boolean>();
  return (
    <ChatLayout
      threads={<nav aria-label="Threads">Threads</nav>}
      threadsOpen={threadsOpen}
      onThreadsOpenChange={setThreadsOpen}
      detailsOpen={false}
      onDetailsOpenChange={() => undefined}
    >
      <p>Conversation</p>
    </ChatLayout>
  );
}

describe('ChatLayout', () => {
  it('closes the default-open desktop threads with the keyboard and opens them again', () => {
    render(<DefaultThreadsLayout />);
    expect(screen.getByText('Threads').closest('[inert]')).toBeNull();

    fireEvent.keyDown(window, { key: '{', shiftKey: true });
    expect(screen.getByText('Threads').closest('[inert]')).not.toBeNull();

    fireEvent.keyDown(window, { key: '{', shiftKey: true });
    expect(screen.getByText('Threads').closest('[inert]')).toBeNull();
  });

  it('opens the default-closed mobile threads with the keyboard', () => {
    mobile = true;
    render(<DefaultThreadsLayout />);
    expect(screen.queryByRole('navigation', { name: 'Threads' })).toBeNull();

    fireEvent.keyDown(window, { key: '{', shiftKey: true });

    expect(screen.getByRole('dialog').textContent).toContain('Threads');
    expect(screen.getByRole('navigation', { name: 'Threads' })).toBeTruthy();
  });
  it('shows threads, the chat and Details side by side when Details is open', () => {
    renderLayout(true);

    expect(screen.getByRole('navigation', { name: 'Threads' })).toBeTruthy();
    expect(screen.getByText('Conversation')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Details' }).closest('[inert]')).toBeNull();
  });

  it('keeps a closed Details card out of reach of the keyboard and screen readers', () => {
    renderLayout(false);

    expect(screen.getByText('Details').closest('[inert]')).not.toBeNull();
  });

  it('opens Details as a drawer on small screens, and only when asked', () => {
    mobile = true;
    const { rerender } = renderLayout(false);
    expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Threads' })).toBeNull();

    rerender(
      <ChatLayout
        threads={<nav aria-label="Threads">Threads</nav>}
        details={<aside aria-label="Details">Details</aside>}
        detailsOpen
        onDetailsOpenChange={() => undefined}
      >
        <p>Conversation</p>
      </ChatLayout>,
    );
    expect(screen.getByRole('dialog').textContent).toContain('Details');
  });

  it('toggles threads with { and Details with ], but not while typing', () => {
    const onThreadsOpenChange = vi.fn();
    const onDetailsOpenChange = vi.fn();
    render(
      <ChatLayout
        threads={<nav aria-label="Threads">Threads</nav>}
        threadsOpen
        onThreadsOpenChange={onThreadsOpenChange}
        details={<aside aria-label="Details">Details</aside>}
        detailsOpen={false}
        onDetailsOpenChange={onDetailsOpenChange}
      >
        <input aria-label="Message" />
      </ChatLayout>,
    );

    fireEvent.keyDown(window, { key: '{', shiftKey: true });
    fireEvent.keyDown(window, { key: ']' });
    expect(onThreadsOpenChange).toHaveBeenCalledWith(false);
    expect(onDetailsOpenChange).toHaveBeenCalledWith(true);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: ']', bubbles: true });
    expect(onDetailsOpenChange).toHaveBeenCalledTimes(1);
  });
});
