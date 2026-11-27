// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { PhaseSetup } from './phase-setup';
import { createHoverCardHandle } from '@/ds/components/HoverCard';

afterEach(cleanup);

const Link = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>((props, ref) => (
  <a ref={ref} {...props} />
));

const base = {
  phaseId: 'build',
  href: '/config/build',
  summary: 'Build runs coding.',
  arriving: 0,
  agent: false,
  autoStart: false,
  exitTool: false,
  LinkComponent: Link,
};

describe('PhaseSetup', () => {
  it('renders nothing for a phase with no setup', () => {
    const { container } = render(<PhaseSetup handle={createHoverCardHandle<string>()} {...base} />);
    expect(container.childElementCount).toBe(0);
  });

  it('links to the phase settings, named by its summary', () => {
    render(<PhaseSetup handle={createHoverCardHandle<string>()} {...base} agent arriving={2} />);
    const link = screen.getByRole('link', { name: 'Build runs coding.' });
    expect(link.getAttribute('href')).toBe('/config/build');
    expect(link.textContent).toContain('2');
  });
});
