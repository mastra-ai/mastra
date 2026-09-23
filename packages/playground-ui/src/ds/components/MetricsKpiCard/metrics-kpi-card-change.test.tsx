import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetricsKpiCardChange } from './metrics-kpi-card-change';

describe('MetricsKpiCardChange', () => {
  it.each([
    [15.3, '15%'],
    [9.9, '9.9%'],
    [-9.9, '-9.9%'],
  ])('formats %s as %s', (changePct, expected) => {
    expect(renderToStaticMarkup(<MetricsKpiCardChange changePct={changePct} />)).toContain(expected);
  });
});
