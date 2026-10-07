import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetricsLineChartTooltip } from './metrics-line-chart-tooltip';

const payload = [
  { name: '2xx', value: 3420, color: 'green' },
  { name: '5xx', value: 311, color: 'red' },
];

describe('MetricsLineChartTooltip', () => {
  it('adds a Total row with the sum of every row when showTotal is set', () => {
    const html = renderToStaticMarkup(<MetricsLineChartTooltip active label="5 PM" payload={payload} showTotal />);
    expect(html).toContain('Total');
    expect(html).toContain('3,731');
  });

  it('has no Total row by default', () => {
    const html = renderToStaticMarkup(<MetricsLineChartTooltip active label="5 PM" payload={payload} />);
    expect(html).not.toContain('Total');
  });

  it('shows a dash for a missing reading and leaves it out of the total', () => {
    const html = renderToStaticMarkup(
      <MetricsLineChartTooltip
        active
        label="5 PM"
        payload={[
          { name: '2xx', value: 10, color: 'green' },
          { name: '4xx', value: Number.NaN, color: 'amber' },
        ]}
        showTotal
        suffix="ms"
      />,
    );
    expect(html).not.toContain('NaN');
    expect(html).toContain('—');
    expect(html).toContain('10ms');
  });

  it('formats each series with its own formatter and reads the heading from the row', () => {
    const html = renderToStaticMarkup(
      <MetricsLineChartTooltip
        active
        label="5 PM"
        labelKey="time"
        formatByKey={{ wake: v => `${v}ms` }}
        payload={[
          { name: 'Cold starts', value: 3, color: 'green', dataKey: 'cold', payload: { time: 'Oct 2, 5:00 PM' } },
          { name: 'Wake', value: 900, color: 'sky', dataKey: 'wake', payload: { time: 'Oct 2, 5:00 PM' } },
        ]}
      />,
    );
    expect(html).toContain('Oct 2, 5:00 PM');
    expect(html).toContain('900ms');
  });
});
