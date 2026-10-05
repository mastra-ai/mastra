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
});
