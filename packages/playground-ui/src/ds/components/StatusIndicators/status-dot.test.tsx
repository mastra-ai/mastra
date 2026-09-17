import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusDot } from './status-dot';
import type { StatusPresentation } from './status-dot-styles';
import { TooltipProvider } from '@/ds/components/Tooltip';

const RUNNING: StatusPresentation = {
  label: 'Running',
  tone: 'success',
  description: 'The server is live.',
};

function presentation(): StatusPresentation {
  return RUNNING;
}

describe('StatusDot', () => {
  it('renders a named status trigger', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider delay={0}>
        <StatusDot status="running" presentation={presentation} variant="static" />
      </TooltipProvider>,
    );

    expect(html).toContain('aria-label="Running"');
    expect(html).toContain('<button');
  });

  it('renders decorative dots outside the accessibility tree', () => {
    const html = renderToStaticMarkup(
      <StatusDot status="running" presentation={presentation} variant="static" decorative />,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
  });
});
