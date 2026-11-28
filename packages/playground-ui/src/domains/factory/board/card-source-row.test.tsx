// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CardSourceIcon, CardSourceRow, SourceStateBadge } from './card-source-row';

afterEach(cleanup);

describe('CardSourceIcon', () => {
  it('stamps the source and stays hidden from screen readers', () => {
    const { container } = render(<CardSourceIcon source="github-issue" />);
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('data-source')).toBe('github-issue');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SourceStateBadge', () => {
  it('names the state for screen readers', () => {
    render(<SourceStateBadge state="open" />);
    expect(screen.getByLabelText('Source state: open').textContent).toBe('open');
  });

  it('renders nothing without a state', () => {
    const { container } = render(<SourceStateBadge state={undefined} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('CardSourceRow', () => {
  it('links out to the upstream under an accessible name', () => {
    render(<CardSourceRow reference="#117" url="https://github.com/mastra-ai/office/issues/117" state="open" />);
    const link = screen.getByRole('link', { name: 'Open #117' });
    expect(link.getAttribute('href')).toBe('https://github.com/mastra-ai/office/issues/117');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByLabelText('Source state: open')).toBeTruthy();
  });

  it('shows labels without a link', () => {
    render(<CardSourceRow reference="#117" labels={<span>bug</span>} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('bug')).toBeTruthy();
  });

  it('renders nothing when there is no link, state or labels', () => {
    const { container } = render(<CardSourceRow reference="#117" />);
    expect(container.innerHTML).toBe('');
  });
});
