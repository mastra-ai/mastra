// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { TokenTimelinePoint } from '../hooks/use-token-usage-timeseries';
import { TokenUsageTimelineCardView } from './token-usage-timeline-card-view';

const data: TokenTimelinePoint[] = [
  {
    time: 'Jun 01',
    tsMs: new Date('2026-06-01T00:00:00.000Z').getTime(),
    input: 1200,
    output: 300,
    total: 1500,
    cost: 0.042,
    costUnit: 'usd',
  },
  {
    time: 'Jun 02',
    tsMs: new Date('2026-06-02T00:00:00.000Z').getTime(),
    input: 800,
    output: 200,
    total: 1000,
    cost: 0.028,
    costUnit: 'usd',
  },
];

afterEach(() => {
  cleanup();
});

describe('TokenUsageTimelineCardView', () => {
  it('renders token totals and bucket-specific copy', () => {
    render(<TokenUsageTimelineCardView data={data} interval="1h" isLoading={false} isError={false} />);

    expect(screen.getByText('Token usage over time')).toBeTruthy();
    expect(screen.getByText('Input and output tokens per hour.')).toBeTruthy();
    expect(screen.getByText('2.5K')).toBeTruthy();
    expect(screen.getByText('Total tokens')).toBeTruthy();
    expect(screen.getByText('Input tokens')).toBeTruthy();
    expect(screen.getByText('Output tokens')).toBeTruthy();
  });

  it('shows the cost tab only when cost has a single known unit', () => {
    render(<TokenUsageTimelineCardView data={data} interval="1d" isLoading={false} isError={false} />);

    fireEvent.click(screen.getByText('Cost'));

    expect(screen.getAllByText('$0.07')).toHaveLength(2);
    expect(screen.getByText('Total cost')).toBeTruthy();
  });

  it('does not display mixed-unit cost totals', () => {
    render(
      <TokenUsageTimelineCardView
        data={[
          { ...data[0], costUnit: 'usd' },
          { ...data[1], costUnit: 'eur' },
        ]}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByText('Cost'));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
  });

  it('shows no data state when empty', () => {
    render(<TokenUsageTimelineCardView data={[]} interval="1d" isLoading={false} isError={false} />);

    expect(screen.getByText('No token usage data yet')).toBeTruthy();
  });
});
