// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TextLink } from './text-link';

afterEach(cleanup);

function RouterLink({ to, ...props }: { to: string; className?: string; children?: ReactNode }) {
  return <a href={to} data-router="" {...props} />;
}

describe('TextLink', () => {
  it('renders an anchor named by its label', () => {
    render(<TextLink href="/usage">View usage</TextLink>);

    expect(screen.getByRole('link', { name: 'View usage' }).getAttribute('href')).toBe('/usage');
  });

  it('puts the label in its own slot ahead of the arrow', () => {
    render(<TextLink href="/usage">View usage</TextLink>);

    const link = screen.getByRole('link');
    const label = link.querySelector('[data-slot="text-link-label"]');
    expect(label?.textContent).toBe('View usage');
    expect(link.firstElementChild).toBe(label);
    expect(link.lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('hides the default arrow from assistive tech', () => {
    render(<TextLink href="/usage">View usage</TextLink>);

    expect(screen.getByRole('link').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders without an icon when icon is false', () => {
    render(
      <TextLink href="/usage" icon={false}>
        View usage
      </TextLink>,
    );

    expect(screen.getByRole('link').querySelector('svg')).toBeNull();
  });

  it('renders through a router link element', () => {
    render(<TextLink render={<RouterLink to="/projects" />}>View projects</TextLink>);

    const link = screen.getByRole('link', { name: 'View projects' });
    expect(link.getAttribute('href')).toBe('/projects');
    expect(link.hasAttribute('data-router')).toBe(true);
  });

  it('passes target and rel through for external links', () => {
    render(
      <TextLink href="https://billing.example.com" target="_blank" rel="noopener noreferrer">
        Open billing portal
      </TextLink>,
    );

    const link = screen.getByRole('link', { name: 'Open billing portal' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
