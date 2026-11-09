// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { SidebarNavShowMore } from './sidebar-nav-show-more';

afterEach(() => cleanup());

function FoldedList({ foldedCount }: { foldedCount: number }) {
  const [expanded, setExpanded] = useState(false);
  return <SidebarNavShowMore foldedCount={foldedCount} expanded={expanded} onExpandedChange={setExpanded} />;
}

describe('SidebarNavShowMore', () => {
  it('unfolds the hidden rows and folds them back', async () => {
    const user = userEvent.setup();
    render(<FoldedList foldedCount={3} />);

    const toggle = screen.getByRole('button', { name: 'Show 3 more' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByRole('button', { name: 'Show 3 more' })).not.toBeNull();
  });

  it.each([0, -2])('renders nothing when the list is not longer than the fold (%i)', foldedCount => {
    render(<FoldedList foldedCount={foldedCount} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing on the collapsed rail, where its label has no room', () => {
    render(<SidebarNavShowMore foldedCount={3} expanded={false} onExpandedChange={() => {}} state="collapsed" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
