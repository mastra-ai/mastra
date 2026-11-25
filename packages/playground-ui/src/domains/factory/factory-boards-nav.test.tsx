// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactoryBoardsNav } from './factory-boards-nav';
import { Sidebar, SidebarProvider } from '@/ds/components/Sidebar';
import type { LinkComponentProps } from '@/ds/types/link-component';

afterEach(cleanup);

const boards = [
  { id: 'work', title: 'Work', href: '/f/boards/work' },
  { id: 'bugs', title: 'Bugs', href: '/f/boards/bugs' },
];

describe('FactoryBoardsNav', () => {
  it('links each board and marks the active one', () => {
    render(
      <FactoryBoardsNav boards={boards} isActive={href => href === '/f/boards/bugs'} newBoardHref="/f/boards/new" />,
    );

    expect(screen.getByRole('link', { name: 'Work' }).getAttribute('href')).toBe('/f/boards/work');
    expect(screen.getByRole('link', { name: 'Bugs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'New board' }).getAttribute('href')).toBe('/f/boards/new');
  });

  it('uses the Sidebar’s router link when the host passes none', () => {
    const RouterLink = (props: LinkComponentProps) => <a data-router-link {...props} />;
    render(
      <SidebarProvider LinkComponent={RouterLink}>
        <FactoryBoardsNav boards={boards} newBoardHref="/f/boards/new" />
      </SidebarProvider>,
    );

    const links = screen.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/f/boards/work', '/f/boards/bugs', '/f/boards/new']);
    expect(links.every(link => link.hasAttribute('data-router-link'))).toBe(true);
  });

  it('tells the host each time a board or the New board link is followed', () => {
    const onNavigate = vi.fn();
    render(<FactoryBoardsNav boards={boards} newBoardHref="/f/boards/new" onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('link', { name: 'Work' }));
    fireEvent.click(screen.getByRole('link', { name: 'New board' }));

    expect(onNavigate).toHaveBeenCalledTimes(2);
  });

  it('does not tell the host about navigation when a board’s action is clicked', () => {
    const onNavigate = vi.fn();
    const onConfigure = vi.fn();
    render(
      <FactoryBoardsNav
        boards={boards}
        onNavigate={onNavigate}
        boardAction={board => <Sidebar.NavAction aria-label={`Configure ${board.title}`} onClick={onConfigure} />}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configure Work' }));

    expect(onConfigure).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('announces loading boards, then an empty catalog', () => {
    const { rerender } = render(<FactoryBoardsNav boards={undefined} />);
    expect(screen.getByRole('status', { name: 'Loading boards' })).toBeTruthy();

    rerender(<FactoryBoardsNav boards={[]} />);
    expect(screen.getByRole('status').textContent).toBe('No boards installed.');
  });

  it('reports a load failure and retries on request', () => {
    const onRetry = vi.fn();
    render(<FactoryBoardsNav boards={undefined} error onRetry={onRetry} />);

    expect(screen.getByRole('alert').textContent).toContain('Couldn’t load boards');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
