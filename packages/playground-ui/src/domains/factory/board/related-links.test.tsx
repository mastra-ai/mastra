// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BoardLoadingSkeleton } from './board-loading-skeleton';
import { RelatedCardLink, RelatedItemLink, UpstreamLinks } from './related-links';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

describe('RelatedItemLink', () => {
  it('routes in the app by default and marks a live session', () => {
    render(
      <TooltipProvider>
        <RelatedItemLink
          href="/cards/1"
          icon={null}
          label="#12"
          ariaLabel="Open live session for #12"
          tooltip={['Blocks']}
          live
        />
      </TooltipProvider>,
    );
    const link = screen.getByRole('link', { name: 'Open live session for #12' });
    expect(link.getAttribute('href')).toBe('/cards/1');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.querySelector('[data-live-session-indicator]')).not.toBeNull();
  });

  it('opens an external item in a new tab', () => {
    render(
      <TooltipProvider>
        <RelatedItemLink href="https://x/1" icon={null} label="#1" ariaLabel="Issue: #1" tooltip={[]} external />
      </TooltipProvider>,
    );
    expect(screen.getByRole('link', { name: 'Issue: #1' }).getAttribute('target')).toBe('_blank');
  });
});

describe('UpstreamLinks', () => {
  it('renders one new-tab link per upstream item', () => {
    render(
      <UpstreamLinks
        links={[
          { url: 'https://x/1', label: 'office#1', ariaLabel: 'Issue: office#1', icon: null },
          { url: 'https://x/2', label: 'office#2', ariaLabel: 'Pull request: office#2', icon: null },
        ]}
      />,
    );
    expect(screen.getAllByRole('link').map(link => link.getAttribute('aria-label'))).toEqual([
      'Issue: office#1',
      'Pull request: office#2',
    ]);
  });
});

describe('RelatedCardLink', () => {
  it('shows reference, title and phase', () => {
    render(
      <RelatedCardLink
        href="/cards/2"
        icon={null}
        ariaLabel="Open #2, Build"
        reference="#2"
        title="Scaffold"
        phase={{ icon: null, label: 'Build' }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Open #2, Build' });
    expect(link.textContent).toBe('#2ScaffoldBuild');
  });
});

describe('BoardLoadingSkeleton', () => {
  it('announces loading and draws phase headers only in board layout', () => {
    const { container, rerender } = render(<BoardLoadingSkeleton layout="board" />);
    expect(screen.getByRole('status', { name: 'Loading boards' })).toBeTruthy();
    expect(container.querySelectorAll('.h-8.w-80')).toHaveLength(3);
    rerender(<BoardLoadingSkeleton layout="list" />);
    expect(container.querySelectorAll('.h-8.w-80')).toHaveLength(0);
  });
});
