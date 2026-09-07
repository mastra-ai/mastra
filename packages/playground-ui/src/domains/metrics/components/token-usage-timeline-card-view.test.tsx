// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { TokenTimelinePoint } from '../hooks/use-token-usage-timeseries';
import { TokenUsageTimelineCardView } from './token-usage-timeline-card-view';

const firstPoint: TokenTimelinePoint = {
  time: 'Jun 01',
  tsMs: new Date('2026-06-01T00:00:00.000Z').getTime(),
  input: 1200,
  output: 300,
  total: 1500,
  cost: 0.042,
  costUnit: 'usd',
};

const secondPoint: TokenTimelinePoint = {
  time: 'Jun 02',
  tsMs: new Date('2026-06-02T00:00:00.000Z').getTime(),
  input: 800,
  output: 200,
  total: 1000,
  cost: 0.028,
  costUnit: 'usd',
};

const data: TokenTimelinePoint[] = [firstPoint, secondPoint];

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

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getAllByText('$0.07')).toHaveLength(2);
    expect(screen.getByText('Total cost')).toBeTruthy();
    // The tab and the chart legend both name the series being drawn.
    expect(screen.getAllByText('Cost')).toHaveLength(2);
  });

  it('does not display mixed-unit cost totals', () => {
    render(
      <TokenUsageTimelineCardView
        data={[
          { ...firstPoint, costUnit: 'usd' },
          { ...secondPoint, costUnit: 'eur' },
        ]}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByText('Cost'));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
  });

  it('describes daily buckets when the interval is a day', () => {
    render(<TokenUsageTimelineCardView data={data} interval="1d" isLoading={false} isError={false} />);

    expect(screen.getByText('Input and output tokens per day.')).toBeTruthy();
  });

  it('assumes daily buckets when no interval is known yet', () => {
    render(<TokenUsageTimelineCardView data={data} interval={undefined} isLoading={false} isError={false} />);

    expect(screen.getByText('Input and output tokens per day.')).toBeTruthy();
  });

  it('sums input and output separately in the chart legend', () => {
    render(<TokenUsageTimelineCardView data={data} interval="1d" isLoading={false} isError={false} />);

    // 1200 + 800 input, 300 + 200 output — not one combined figure.
    expect(screen.getByText('2.0K')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
  });

  it('goes back to the token total when the user returns to the tokens tab', () => {
    render(<TokenUsageTimelineCardView data={data} interval="1d" isLoading={false} isError={false} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));
    expect(screen.getByText('Total cost')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Tokens' }));
    expect(screen.getByText('Total tokens')).toBeTruthy();
    expect(screen.queryByText('Total cost')).toBeNull();
  });

  it('keeps the token total on the cost tab when there is no cost to show', () => {
    render(
      <TokenUsageTimelineCardView
        data={data.map(point => ({ ...point, cost: null, costUnit: null }))}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
    expect(screen.getByText('Total tokens')).toBeTruthy();
  });

  it('ignores buckets that cost nothing', () => {
    render(
      <TokenUsageTimelineCardView
        data={[
          // Priced in another currency, so counting it would leave the card
          // unable to name a single one — the total would disappear entirely.
          { ...firstPoint, cost: 0, costUnit: 'eur' },
          { ...secondPoint, cost: 0.028, costUnit: 'usd' },
        ]}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getAllByText('$0.03')).toHaveLength(2);
    expect(screen.queryByText('No cost data yet')).toBeNull();
  });

  it('does not let an unpriced bucket drag the currency down with it', () => {
    render(
      <TokenUsageTimelineCardView
        data={[
          { ...firstPoint, cost: 0, costUnit: null },
          { ...secondPoint, cost: 0.028, costUnit: 'usd' },
        ]}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    // A bucket that cost nothing names no currency, and is no reason to
    // call the trace's costs mixed.
    expect(screen.queryByText('No cost data yet')).toBeNull();
    expect(screen.getAllByText('$0.03')).toHaveLength(2);
  });

  it('will not total a cost when one of the buckets names no unit', () => {
    render(
      <TokenUsageTimelineCardView
        data={[
          { ...firstPoint, costUnit: 'usd' },
          { ...secondPoint, costUnit: null },
        ]}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
    expect(screen.queryByText('Total cost')).toBeNull();
  });

  it('reports the cost in whatever currency the buckets agree on', () => {
    render(
      <TokenUsageTimelineCardView
        data={data.map(point => ({ ...point, costUnit: 'eur' }))}
        interval="1d"
        isLoading={false}
        isError={false}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getAllByText('0.0700 eur')).toHaveLength(2);
  });

  it('shows a spinner while loading', () => {
    const { container } = render(<TokenUsageTimelineCardView data={data} interval="1d" isLoading isError={false} />);

    // The spinner itself, not whichever icon happens to be in the card.
    expect(container.querySelector('.spinner')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('explains itself when the load failed', () => {
    const { container } = render(<TokenUsageTimelineCardView data={data} interval="1d" isLoading={false} isError />);

    expect(screen.getByText('Failed to load token usage timeline')).toBeTruthy();
    expect(container.querySelector('.spinner')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('offers its actions only once there is something to act on', () => {
    render(
      <TokenUsageTimelineCardView
        data={data}
        interval="1d"
        isLoading={false}
        isError={false}
        actions={<button type="button">View in Traces</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'View in Traces' })).toBeTruthy();

    cleanup();

    render(
      <TokenUsageTimelineCardView
        data={[]}
        interval="1d"
        isLoading={false}
        isError={false}
        actions={<button type="button">View in Traces</button>}
      />,
    );

    expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
  });

  it('leaves out the headline number when there is nothing to chart', () => {
    render(<TokenUsageTimelineCardView data={[]} interval="1d" isLoading={false} isError={false} />);

    expect(screen.queryByText('Total tokens')).toBeNull();
  });

  it('says there is nothing to chart when the query returned nothing at all', () => {
    render(<TokenUsageTimelineCardView data={undefined} interval="1d" isLoading={false} isError={false} />);

    expect(screen.getByText('No token usage data yet')).toBeTruthy();
  });

  it('shows no data state when empty', () => {
    render(<TokenUsageTimelineCardView data={[]} interval="1d" isLoading={false} isError={false} />);

    expect(screen.getByText('No token usage data yet')).toBeTruthy();
  });
});
