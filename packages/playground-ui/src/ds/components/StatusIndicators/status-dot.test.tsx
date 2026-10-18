import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusDot } from './status-dot';
import { deployStates, statusDotClass, type StatusPresentation } from './status-dot-styles';
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
    const html = renderToStaticMarkup(<StatusDot status="running" presentation={presentation} decorative />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<button');
  });

  it('draws every deploy state as a circle, with rings only for idle and queued', () => {
    for (const [state, presentation] of Object.entries(deployStates)) {
      const classes = statusDotClass(presentation);
      expect(classes).toContain('rounded-full');
      expect(classes.includes('bg-transparent')).toBe(state === 'idle' || state === 'queued');
    }
  });
});
