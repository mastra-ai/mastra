// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignalBadge } from './signal-badge';

describe('SignalBadge', () => {
  it('renders notification summaries', () => {
    render(
      <SignalBadge
        signal={{
          type: 'notification',
          tagName: 'notification-summary',
          contents: 'github: 2',
          attributes: { pending: 99, priority: 'low' },
          metadata: { notification: { signal: 'summary', pending: 2, priority: 'high' } },
        }}
      />,
    );

    expect(screen.getByText('Notification summary')).toBeTruthy();
    expect(screen.getByText('github: 2')).toBeTruthy();
    expect(screen.getByText('2 pending')).toBeTruthy();
    expect(screen.getByText('high')).toBeTruthy();
  });

  it('renders delivered notification signals', () => {
    render(
      <SignalBadge
        signal={{
          type: 'notification',
          tagName: 'notification',
          contents: 'CI failed on main',
          attributes: { source: 'legacy-source', kind: 'legacy-kind', priority: 'low', status: 'pending' },
          metadata: {
            notification: {
              signal: 'notification',
              source: 'github',
              kind: 'ci-status',
              priority: 'medium',
              status: 'delivered',
            },
          },
        }}
      />,
    );

    expect(screen.getByText('github / ci-status')).toBeTruthy();
    expect(screen.getByText('CI failed on main')).toBeTruthy();
    expect(screen.getByText('medium')).toBeTruthy();
    expect(screen.getByText('delivered')).toBeTruthy();
  });

  it('renders state signal previews', () => {
    render(
      <SignalBadge
        signal={{
          type: 'state',
          tagName: 'state',
          contents: 'Browser is on the issues page',
          metadata: { state: { id: 'browser', mode: 'snapshot' } },
        }}
      />,
    );

    expect(screen.getByText('browser')).toBeTruthy();
    expect(screen.getByText('snapshot')).toBeTruthy();
    expect(screen.getByText('Browser is on the issues page')).toBeTruthy();
  });

  it('ignores unknown data', () => {
    const { container } = render(<SignalBadge signal={{ type: 'custom', contents: 'hidden' }} />);

    expect(container.textContent).toBe('');
  });
});
