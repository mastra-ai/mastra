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

  it('shows no change as a neutral 0% without an arrow', () => {
    for (const changePct of [0, 0.04, -0.04]) {
      const html = renderToStaticMarkup(<MetricsKpiCardChange changePct={changePct} />);
      expect(html).toContain('>0%<');
      expect(html).not.toContain('lucide-arrow');
    }
  });

  it('describes the change against the previous window', () => {
    const markup = renderToStaticMarkup(
      <MetricsKpiCardChange changePct={-8.2} comparison="vs previous 7d" prevValue="9,400" />,
    );
    expect(markup).toContain('-8.2% vs previous 7d (9,400)');
  });
});

describe('MetricsKpiCardChange caption', () => {
  it('keeps the comparison for screen readers only by default', () => {
    const html = renderToStaticMarkup(<MetricsKpiCardChange changePct={5} prevValue="10" />);
    expect(html).toContain('class="sr-only">+5.0% vs prior period (10)<');
  });

  it('names the comparison window it is given', () => {
    const html = renderToStaticMarkup(
      <MetricsKpiCardChange changePct={-12.5} comparison="vs previous 7d" prevValue="693" />,
    );
    expect(html).toContain('-13% vs previous 7d (693)');
  });

  it('shows the caption inline when asked', () => {
    const html = renderToStaticMarkup(<MetricsKpiCardChange changePct={5} caption />);
    expect(html).not.toContain('class="sr-only">vs prior period');
    expect(html).toContain('vs prior period');
  });
});
