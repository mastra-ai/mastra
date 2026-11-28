// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ActivityBand, RecapButton } from './activity-band';
import { countsLabel, totalOf } from './activity-format';
import type { Activity } from './activity-model';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const activity = (shipped: number): Activity => ({
  hoursPerSlot: 24,
  ranComplete: true,
  totals: { cameIn: 2, ran: 1, shipped },
  slots: [{ start: 0, end: 1, counts: { cameIn: 2, ran: 1, shipped }, ranComplete: true }],
});
const done = { status: 'success', complete: true } as const;

describe('activity totals', () => {
  it('marks partial run counts as a lower bound and pending ones as loading', () => {
    expect(totalOf('ran', { cameIn: 0, ran: 3, shipped: 0 }, { status: 'success', complete: false }).label).toBe(
      '3+ agent runs',
    );
    expect(totalOf('ran', { cameIn: 0, ran: 0, shipped: 0 }, { status: 'pending', complete: false }).label).toBe(
      'agent runs loading',
    );
    expect(countsLabel({ cameIn: 1, ran: 1, shipped: 0 }, done)).toBe('1 came in, 1 agent run, 0 shipped');
  });
});

describe('ActivityBand', () => {
  it('opens the chart from the totals and leaves out zero live counts', () => {
    render(
      <ActivityBand
        period="week"
        onPeriodChange={() => {}}
        activity={activity(0)}
        runs={done}
        live={[
          { count: 2, label: 'Working' },
          { count: 0, label: 'Waiting on you' },
        ]}
      />,
    );
    const toggle = screen.getByRole('button', { name: '2 came in, 1 agent run, 0 shipped' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('working')).toBeTruthy();
    expect(screen.queryByText('waiting on you')).toBeNull();
  });

  it('shows the recap only once something shipped', () => {
    const recap = <RecapButton label="Recap the week" />;
    const { rerender } = render(
      <ActivityBand
        period="week"
        onPeriodChange={() => {}}
        activity={activity(0)}
        runs={done}
        live={[]}
        recap={recap}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Recap the week' })).toBeNull();
    rerender(
      <ActivityBand
        period="week"
        onPeriodChange={() => {}}
        activity={activity(1)}
        runs={done}
        live={[]}
        recap={recap}
      />,
    );
    expect(screen.getByRole('button', { name: 'Recap the week' })).toBeTruthy();
  });
});
