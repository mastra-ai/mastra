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
    expect(renderToStaticMarkup(<MetricsKpiCardChange changePct={changePct} />)).toContain(expected);
  });
});

describe('MetricsKpiCardChange caption', () => {
  it('keeps "vs prior period" for screen readers only by default', () => {
    const html = renderToStaticMarkup(<MetricsKpiCardChange changePct={5} prevValue="10" />);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('previous value 10');
  });

  it('shows the caption inline when asked', () => {
    const html = renderToStaticMarkup(<MetricsKpiCardChange changePct={5} caption />);
    expect(html).not.toContain('class="sr-only">vs prior period');
    expect(html).toContain('vs prior period');
  });
});
