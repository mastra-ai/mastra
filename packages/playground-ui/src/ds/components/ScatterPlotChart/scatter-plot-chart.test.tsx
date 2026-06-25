// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScatterPlotChart } from './scatter-plot-chart';
import { ScatterPlotChartTooltip } from './scatter-plot-chart-tooltip';
import {
  formatScatterPlotAxisTick,
  getScatterPlotClickedPoint,
  getScatterPlotPointColor,
} from './scatter-plot-chart-utils';
import { Colors } from '@/ds/tokens';

afterEach(() => {
  cleanup();
});

describe('ScatterPlotChart', () => {
  it('renders an empty state when no data is available', () => {
    render(<ScatterPlotChart data={[]} xKey="duration" yKey="cost" />);

    expect(screen.getByText('No data to display')).not.toBeNull();
  });

  it('does not render a point count legend for supplied data', () => {
    render(
      <ScatterPlotChart
        data={[
          { id: 'trace-a', duration: 120, cost: 0.4 },
          { id: 'trace-b', duration: 240, cost: 0.8 },
        ]}
        xKey="duration"
        yKey="cost"
      />,
    );

    expect(screen.queryByText('Points')).toBeNull();
    expect(screen.queryByText('2')).toBeNull();
  });

  it('keeps formatted axis ticks on a single line', () => {
    expect(formatScatterPlotAxisTick(12, value => `${value} spans`)).toBe('12\u00A0spans');
  });

  it('uses design tokens as the default point color', () => {
    expect(getScatterPlotPointColor({ id: 'trace-a' })).toBe(Colors.accent3);
  });

  it('supports render-only color overrides from each datum', () => {
    expect(getScatterPlotPointColor({ id: 'trace-a', color: Colors.accent5 }, 'color')).toBe(Colors.accent5);
    expect(getScatterPlotPointColor({ id: 'trace-a', color: 12 }, 'color')).toBe(Colors.accent3);
  });

  it('extracts clicked point payloads from Recharts event payloads', () => {
    const point = { id: 'trace-a', duration: 120, cost: 0.4 };

    expect(getScatterPlotClickedPoint({ payload: point })).toBe(point);
    expect(getScatterPlotClickedPoint(undefined)).toBeUndefined();
  });
});

describe('ScatterPlotChartTooltip', () => {
  it('formats the active point tooltip with supplied formatters', () => {
    const point = { id: 'trace-a', duration: 120, cost: 0.4 };

    render(
      <ScatterPlotChartTooltip
        active
        payload={[{ payload: point }]}
        xKey="duration"
        yKey="cost"
        nameKey="id"
        formatX={value => `${value}ms`}
        formatY={value => `$${value}`}
      />,
    );

    expect(screen.getByText('trace-a')).not.toBeNull();
    expect(screen.getByText('120ms')).not.toBeNull();
    expect(screen.getByText('$0.4')).not.toBeNull();
  });

  it('returns nothing when inactive', () => {
    const { container } = render(<ScatterPlotChartTooltip xKey="duration" yKey="cost" />);

    expect(container.firstChild).toBeNull();
  });

  it('supports custom tooltip labels', () => {
    const formatTooltipLabel = vi.fn(() => 'Trace summary');
    const point = { id: 'trace-a', duration: 120, cost: 0.4 };

    render(
      <ScatterPlotChartTooltip
        active
        payload={[{ payload: point }]}
        xKey="duration"
        yKey="cost"
        formatTooltipLabel={formatTooltipLabel}
      />,
    );

    expect(formatTooltipLabel).toHaveBeenCalledWith(point);
    expect(screen.getByText('Trace summary')).not.toBeNull();
  });
});
