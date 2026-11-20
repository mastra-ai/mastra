// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComposerStatus, ComposerStatusEnd, ComposerStatusStart } from './composer';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

interface SessionStatus {
  steering?: string;
  announcement?: string;
  tokenRate?: string;
  emptyWrapper?: boolean;
}

function StatusFooter({ steering, announcement, tokenRate, emptyWrapper }: SessionStatus) {
  return (
    <ComposerStatus aria-label="Session status">
      <ComposerStatusStart>
        {steering && <span>{steering}</span>}
        {emptyWrapper && (
          <span>
            <span> </span>
          </span>
        )}
        {announcement && (
          <span className="sr-only" role="status">
            {announcement}
          </span>
        )}
      </ComposerStatusStart>
      <ComposerStatusEnd>{tokenRate}</ComposerStatusEnd>
    </ComposerStatus>
  );
}

const footer = () => screen.getByLabelText('Session status');
const isCollapsed = () => footer().hasAttribute('data-empty');
const flushMutations = () => act(() => Promise.resolve());

describe('Composer status footer', () => {
  it('gives its row back when nothing in it would be seen', () => {
    render(<StatusFooter />);

    expect(isCollapsed()).toBe(true);
  });

  it('keeps a screen-reader announcement without opening a blank row for it', () => {
    render(<StatusFooter announcement="Working…" />);

    expect(isCollapsed()).toBe(true);
    expect(screen.getByRole('status')).toHaveProperty('textContent', 'Working…');
  });

  it('gives its row back when a status renders only an empty wrapper', () => {
    render(<StatusFooter emptyWrapper />);

    expect(isCollapsed()).toBe(true);
  });

  it('shows plain text dropped straight into a group', () => {
    render(<StatusFooter tokenRate="42 tok/s" />);

    expect(isCollapsed()).toBe(false);
  });

  it('opens as soon as status arrives', async () => {
    const { rerender } = render(<StatusFooter />);

    rerender(<StatusFooter steering="You're steering Sam's session" />);
    await flushMutations();

    expect(isCollapsed()).toBe(false);
  });

  it('waits before closing, so status that blinks out and back never moves the composer', async () => {
    const { rerender } = render(<StatusFooter tokenRate="42 tok/s" />);

    rerender(<StatusFooter />);
    await flushMutations();
    act(() => vi.advanceTimersByTime(300));
    expect(isCollapsed()).toBe(false);

    rerender(<StatusFooter steering="You're steering Sam's session" />);
    await flushMutations();
    act(() => vi.advanceTimersByTime(1000));
    expect(isCollapsed()).toBe(false);
  });

  it('closes on time while hidden announcements keep arriving', async () => {
    const { rerender } = render(<StatusFooter tokenRate="42 tok/s" />);

    rerender(<StatusFooter announcement="Working" />);
    await flushMutations();
    for (const announcement of ['Working.', 'Working..', 'Working...']) {
      act(() => vi.advanceTimersByTime(200));
      rerender(<StatusFooter announcement={announcement} />);
      await flushMutations();
    }

    expect(isCollapsed()).toBe(true);
  });

  it('closes once status has stayed gone', async () => {
    const { rerender } = render(<StatusFooter tokenRate="42 tok/s" />);

    rerender(<StatusFooter />);
    await flushMutations();
    act(() => vi.advanceTimersByTime(600));

    expect(isCollapsed()).toBe(true);
  });
});
