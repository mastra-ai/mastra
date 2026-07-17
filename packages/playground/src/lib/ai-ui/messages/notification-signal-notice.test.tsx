import type { NoticeVariant } from '@mastra/playground-ui/components/Notice';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { NotificationSignalNotice } from './notification-signal-notice';
import { getNotificationNoticeVariant } from './notification-signal-notice-variant';
import type { SignalData } from './signal-data';

afterEach(() => cleanup());

const priorityCases = [
  { priority: 'urgent', variant: 'destructive' },
  { priority: 'high', variant: 'warning' },
  { priority: 'medium', variant: 'info' },
  { priority: 'low', variant: 'note' },
  { priority: 'unexpected', variant: 'note' },
  { priority: undefined, variant: 'note' },
] satisfies Array<{ priority: string | undefined; variant: NoticeVariant }>;

describe('getNotificationNoticeVariant', () => {
  describe.each(priorityCases)('when the priority is $priority', ({ priority, variant }) => {
    it(`returns the ${variant} variant`, () => {
      expect(getNotificationNoticeVariant(priority)).toBe(variant);
    });
  });
});

describe('NotificationSignalNotice', () => {
  describe('when the signal contains complete notification metadata', () => {
    const signal = {
      type: 'notification',
      contents: [
        { type: 'text', text: 'Studio crashes when I open a workflow' },
        { type: 'text', text: 'Opening any workflow shows a blank page.' },
      ],
      metadata: {
        notification: {
          signal: 'notification',
          source: 'github',
          kind: 'issue-opened',
          priority: 'urgent',
          status: 'delivered',
          pending: 0,
        },
      },
    } satisfies SignalData;

    it('renders the source and kind as the title', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('github / issue-opened')).not.toBeNull();
    });

    it('renders every text content part', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(
        screen.getByText('Studio crashes when I open a workflow Opening any workflow shows a blank page.'),
      ).not.toBeNull();
    });

    it('renders the priority metadata', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('urgent')).not.toBeNull();
    });

    it('renders the status metadata', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('delivered')).not.toBeNull();
    });

    it('keeps a zero pending count visible', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('0 pending')).not.toBeNull();
    });
  });

  describe('when notification metadata is provided through attributes', () => {
    const signal = {
      type: 'notification',
      contents: 'A workflow mention needs attention.',
      attributes: {
        source: 'slack',
        kind: 'mention',
        priority: 'medium',
        status: 'seen',
        pending: 3,
      },
    } satisfies SignalData;

    it('uses the attribute title fallback', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('slack / mention')).not.toBeNull();
    });

    it('uses the attribute priority fallback', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('medium')).not.toBeNull();
    });

    it('uses the attribute status fallback', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('seen')).not.toBeNull();
    });

    it('uses the attribute pending-count fallback', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('3 pending')).not.toBeNull();
    });
  });

  describe('when content includes empty and unsupported parts', () => {
    const signal = {
      type: 'notification',
      contents: [
        { type: 'text', text: 'First visible line' },
        { type: 'text', text: '' },
        { type: 'file', data: 'ignored' },
        { type: 'text', text: 'Second visible line' },
      ],
    } satisfies SignalData;

    it('preserves visible text without adding blank separators', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('First visible line Second visible line').textContent).toBe(
        'First visible line\nSecond visible line',
      );
    });
  });

  describe('when attribute metadata contains empty strings', () => {
    const signal = {
      type: 'notification',
      contents: 'The notification body remains visible.',
      attributes: { priority: '', status: '', pending: '' },
    } satisfies SignalData;

    it('does not render empty metadata labels', () => {
      const { container } = render(<NotificationSignalNotice signal={signal} />);

      expect(container.textContent).toBe('NotificationThe notification body remains visible.');
    });
  });

  describe('when the signal is a notification summary', () => {
    const signal = {
      type: 'notification',
      tagName: 'notification-summary',
      contents: 'github: 2',
      attributes: { priority: 'high', pending: 2 },
    } satisfies SignalData;

    it('renders the summary title', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('Notification summary')).not.toBeNull();
    });

    it('renders the summary body', () => {
      render(<NotificationSignalNotice signal={signal} />);

      expect(screen.getByText('github: 2')).not.toBeNull();
    });
  });

  describe('when the signal has no displayable content or metadata', () => {
    const signal = {
      type: 'notification',
      contents: [{ type: 'file', data: 'ignored' }],
    } satisfies SignalData;

    it('renders only the fallback title', () => {
      const { container } = render(<NotificationSignalNotice signal={signal} />);

      expect(container.textContent).toBe('Notification');
    });
  });
});
