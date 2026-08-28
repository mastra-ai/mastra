// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TraceDescription } from '../trace-description';

const Anchor = ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a href={href} {...props}>
    {children}
  </a>
);

const rootSpan = {
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  entityType: 'agent',
  startedAt: new Date('2026-08-28T09:12:34.000Z'),
  endedAt: new Date('2026-08-28T09:12:36.500Z'),
};

afterEach(cleanup);

describe('TraceDescription', () => {
  it('leads with how long the trace took, then when it started', () => {
    render(<TraceDescription rootSpan={rootSpan} />);

    const text = screen.getByTestId('trace-description').textContent ?? '';

    expect(text).toContain('2.5s');
    expect(text.indexOf('2.5s')).toBeLessThan(text.indexOf('Aug 28'));
  });

  it('names the entity the trace ran, and says what kind it is', () => {
    render(<TraceDescription rootSpan={rootSpan} />);

    expect(screen.getByText('Weather Agent')).toBeTruthy();
    expect(screen.getByLabelText('Agent')).toBeTruthy();
  });

  it('links out to the entity when the app gave it a way to route', () => {
    render(<TraceDescription rootSpan={rootSpan} LinkComponent={Anchor} />);

    expect(screen.getByRole('link', { name: 'Open Weather Agent' }).getAttribute('href')).toBe('/agents/weather-agent');
  });

  it('routes a workflow run to its graph', () => {
    render(
      <TraceDescription
        rootSpan={{ ...rootSpan, entityId: 'my-workflow', entityName: 'My Workflow', entityType: 'workflow_run' }}
        LinkComponent={Anchor}
      />,
    );

    expect(screen.getByRole('link', { name: 'Open My Workflow' }).getAttribute('href')).toBe(
      '/workflows/my-workflow/graph',
    );
  });

  it('stays plain text for entities with no page of their own', () => {
    render(
      <TraceDescription
        rootSpan={{ ...rootSpan, entityId: 'scorer-1', entityName: 'Scorer', entityType: 'scorer' }}
        LinkComponent={Anchor}
      />,
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Scorer')).toBeTruthy();
  });

  it('says nothing about an entity the trace never named', () => {
    render(<TraceDescription rootSpan={{ startedAt: rootSpan.startedAt, endedAt: rootSpan.endedAt }} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('trace-description').textContent).toContain('2.5s');
  });
});
