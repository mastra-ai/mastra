import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetricsKpiCardChange } from './metrics-kpi-card-change';

describe('MetricsKpiCardChange', () => {
  it.each([
    [15.3, '15%'],
    [9.9, '9.9%'],
    [-9.9, '-9.9%'],
    [999, '+999%'],
    [1000, '×11'],
    [250000, '×2.5K'],
    [187681, '×1.9K'],
  ])('formats %s as %s', (changePct, expected) => {
    expect(renderToStaticMarkup(<MetricsKpiCardChange changePct={changePct} comparison="vs previous 24h" />)).toContain(
      expected,
    );
  });

  it('describes the change against the previous window', () => {
    const markup = renderToStaticMarkup(
      <MetricsKpiCardChange changePct={-8.2} comparison="vs previous 7d" prevValue="9,400" />,
    );
    expect(markup).toContain('-8.2% vs previous 7d (9,400)');
  });
});
