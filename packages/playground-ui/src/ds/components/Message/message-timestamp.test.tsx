// @vitest-environment jsdom
import '@/test/english-locale';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Message, MessageActions } from './message';
import { MessageTimestamp } from './message-timestamp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const NOW = new Date(2026, 10, 3, 22, 31, 0);
const SENT = new Date(2026, 10, 3, 22, 24, 0);

describe('MessageTimestamp', () => {
  it.each(['not-a-date', '', new Date(NaN)])('keeps the message visible when its timestamp is invalid (%s)', value => {
    const { container } = render(
      <Message from="assistant" footer={<MessageTimestamp value={value} />}>
        A readable reply
      </Message>,
    );

    expect(screen.getByText('A readable reply')).toBeTruthy();
    expect(container.querySelector('time')).toBeNull();
  });

  it.each([SENT.toISOString(), SENT])(
    'says how long ago the message was sent, and its full date on hover (%s)',
    async value => {
      vi.useFakeTimers({ now: NOW, shouldAdvanceTime: true });
      const { container } = render(
        <Message
          from="user"
          footer={
            <MessageActions visibility="always">
              <MessageTimestamp value={value} />
            </MessageActions>
          }
        >
          let's update the PR please
        </Message>,
      );
      const time = container.querySelector('time');

      expect(time?.getAttribute('datetime')).toBe(SENT.toISOString());
      expect(time?.textContent).toBe('7 minutes ago');

      act(() => time?.parentElement?.focus());
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent?.replace(/\u202f/g, ' ')).toBe('Nov 3, 2026, 10:24 PM');
    },
  );

  it('reads “just now” for a fresh message, then counts up as it ages', () => {
    vi.useFakeTimers({ now: SENT.getTime() + 20_000 });
    const { container } = render(<MessageTimestamp value={SENT} />);
    const label = () => container.querySelector('time')?.textContent;

    expect(label()).toBe('just now');
    act(() => void vi.advanceTimersByTime(40_000));
    expect(label()).toBe('1 minute ago');
    act(() => void vi.advanceTimersByTime(59 * 60_000));
    expect(label()).toBe('1 hour ago');
  });

  it('reads “just now” for a message stamped a moment ahead of this clock', () => {
    vi.useFakeTimers({ now: SENT.getTime() - 5_000 });
    const { container } = render(<MessageTimestamp value={SENT} />);

    expect(container.querySelector('time')?.textContent).toBe('just now');
  });
});
