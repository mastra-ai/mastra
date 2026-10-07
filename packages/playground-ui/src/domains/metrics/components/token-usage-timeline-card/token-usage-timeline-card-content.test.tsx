// @vitest-environment jsdom
import type { TokenTimelinePoint } from '@mastra/react/hooks/metrics';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenUsageTimelineCardContent } from './token-usage-timeline-card-content';

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

describe('TokenUsageTimelineCardContent', () => {
  it('shows the cost tab only when cost has a single known unit', () => {
    render(<TokenUsageTimelineCardContent points={data} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('$0.07')).toBeTruthy();
    // The tab and the chart legend both name the series being drawn.
    expect(screen.getAllByText('Cost')).toHaveLength(2);
  });

  it('does not display mixed-unit cost totals', () => {
    render(
      <TokenUsageTimelineCardContent
        points={[
          { ...firstPoint, costUnit: 'usd' },
          { ...secondPoint, costUnit: 'eur' },
        ]}
      />,
    );

    fireEvent.click(screen.getByText('Cost'));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
  });

  it('sums input and output separately in the chart legend', () => {
    render(<TokenUsageTimelineCardContent points={data} />);

    // 1200 + 800 input, 300 + 200 output — not one combined figure.
    expect(screen.getByText('2K')).toBeTruthy();
    expect(screen.getByText('500')).toBeTruthy();
  });

  it('goes back to the token legend when the user returns to the tokens tab', () => {
    render(<TokenUsageTimelineCardContent points={data} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));
    expect(screen.getByText('$0.07')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Tokens' }));
    expect(screen.getByText('2K')).toBeTruthy();
    expect(screen.queryByText('$0.07')).toBeNull();
  });

  it('shows no legend on the cost tab when there is no cost to show', () => {
    render(<TokenUsageTimelineCardContent points={data.map(point => ({ ...point, cost: null, costUnit: null }))} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
    expect(screen.queryByText('Input tokens')).toBeNull();
  });

  it('ignores buckets that cost nothing', () => {
    render(
      <TokenUsageTimelineCardContent
        points={[
          // Priced in another currency, so counting it would leave the card
          // unable to name a single one — the total would disappear entirely.
          { ...firstPoint, cost: 0, costUnit: 'eur' },
          { ...secondPoint, cost: 0.028, costUnit: 'usd' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('$0.03')).toBeTruthy();
    expect(screen.queryByText('No cost data yet')).toBeNull();
  });

  it('does not let an unpriced bucket drag the currency down with it', () => {
    render(
      <TokenUsageTimelineCardContent
        points={[
          { ...firstPoint, cost: 0, costUnit: null },
          { ...secondPoint, cost: 0.028, costUnit: 'usd' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    // A bucket that cost nothing names no currency, and is no reason to
    // call the trace's costs mixed.
    expect(screen.queryByText('No cost data yet')).toBeNull();
    expect(screen.getByText('$0.03')).toBeTruthy();
  });

  it('will not total a cost when one of the buckets names no unit', () => {
    render(
      <TokenUsageTimelineCardContent
        points={[
          { ...firstPoint, costUnit: 'usd' },
          { ...secondPoint, costUnit: null },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('No cost data yet')).toBeTruthy();
    expect(screen.queryByText('$0.07')).toBeNull();
  });

  it('reports the cost in whatever currency the buckets agree on', () => {
    render(<TokenUsageTimelineCardContent points={data.map(point => ({ ...point, costUnit: 'eur' }))} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }));

    expect(screen.getByText('0.07 eur')).toBeTruthy();
  });

  it('shows no data state when empty', () => {
    render(<TokenUsageTimelineCardContent points={[]} />);

    expect(screen.getByText('No token usage data yet')).toBeTruthy();
  });
});
