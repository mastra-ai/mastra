// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactoryBoardsNav } from './factory-boards-nav';

afterEach(cleanup);

describe('FactoryBoardsNav', () => {
  it('links each board and marks the active one', () => {
    render(
      <FactoryBoardsNav
        boards={[
          { id: 'work', title: 'Work', href: '/f/boards/work' },
          { id: 'bugs', title: 'Bugs', href: '/f/boards/bugs' },
        ]}
        isActive={href => href === '/f/boards/bugs'}
        newBoardHref="/f/boards/new"
      />,
    );

    expect(screen.getByRole('link', { name: 'Work' }).getAttribute('href')).toBe('/f/boards/work');
    expect(screen.getByRole('link', { name: 'Bugs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'New board' }).getAttribute('href')).toBe('/f/boards/new');
  });

  it('shows loading, empty and retryable error states', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<FactoryBoardsNav boards={undefined} />);
    expect(screen.getByLabelText('Loading boards')).toBeTruthy();

    rerender(<FactoryBoardsNav boards={[]} />);
    expect(screen.getByRole('status').textContent).toBe('No boards installed.');

    rerender(<FactoryBoardsNav boards={undefined} error onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
