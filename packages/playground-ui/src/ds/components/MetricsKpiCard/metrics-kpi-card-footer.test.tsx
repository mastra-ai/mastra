import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MetricsKpiCardFooter } from './metrics-kpi-card-footer';

describe('MetricsKpiCardFooter', () => {
  it('renders nothing without a detail line, even with a prior value', () => {
    expect(renderToStaticMarkup(<MetricsKpiCardFooter detail={null} prevValue="0.44%" />)).toBe('');
  });

  it('shows the detail and the prior value', () => {
    const html = renderToStaticMarkup(<MetricsKpiCardFooter detail="1.3K server errors" prevValue="0.44%" />);
    expect(html).toContain('1.3K server errors');
    expect(html).toContain('vs 0.44%');
  });
});
