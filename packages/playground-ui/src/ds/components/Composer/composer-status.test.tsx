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
  progress?: number;
  progressHidden?: boolean;
}

function StatusFooter({ steering, announcement, tokenRate, emptyWrapper, progress, progressHidden }: SessionStatus) {
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
      <ComposerStatusEnd>
        {tokenRate}
        {progress !== undefined && (
          <progress aria-label="Context used" value={progress} max={1} hidden={progressHidden} />
        )}
      </ComposerStatusEnd>
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

  it('shows a progress bar that carries no text', () => {
    render(<StatusFooter progress={0.4} />);

    expect(isCollapsed()).toBe(false);
  });

  it('gives its row back when its only status is hidden', () => {
    render(<StatusFooter progress={0.4} progressHidden />);

    expect(isCollapsed()).toBe(true);
  });

  it('closes after the pause once its only status is hidden', async () => {
    const { rerender } = render(<StatusFooter progress={0.4} />);

    rerender(<StatusFooter progress={0.4} progressHidden />);
    await flushMutations();
    act(() => vi.advanceTimersByTime(600));

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
