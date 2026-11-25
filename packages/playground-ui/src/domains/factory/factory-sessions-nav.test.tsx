// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactorySessionsNav } from './factory-sessions-nav';
import type { FactorySessionsNavSession } from './factory-sessions-nav';
import { SidebarProvider } from '@/ds/components/Sidebar';
import type { LinkComponentProps } from '@/ds/types/link-component';

afterEach(cleanup);

const sessions: FactorySessionsNavSession[] = [
  { id: 'login', name: 'Fix login', href: '/p/sessions/login', description: 'Review · 2m ago' },
  { id: 'docs', name: 'Write docs', href: '/p/sessions/docs' },
];

describe('FactorySessionsNav', () => {
  it('links each session and marks the open one as the current page', () => {
    render(<FactorySessionsNav sessions={sessions} isActive={href => href === '/p/sessions/docs'} />);

    const login = screen.getByRole('link', { name: /Fix login/ });
    expect(login.getAttribute('href')).toBe('/p/sessions/login');
    expect(login.textContent).toContain('Review · 2m ago');
    expect(login.getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Write docs' }).getAttribute('aria-current')).toBe('page');
  });

  it('uses the Sidebar’s router link when the host passes none', () => {
    const RouterLink = (props: LinkComponentProps) => <a data-router-link {...props} />;
    render(
      <SidebarProvider LinkComponent={RouterLink}>
        <FactorySessionsNav sessions={sessions} />
      </SidebarProvider>,
    );

    const links = screen.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/p/sessions/login', '/p/sessions/docs']);
    expect(links.every(link => link.hasAttribute('data-router-link'))).toBe(true);
  });

  it('draws each session as an icon in a collapsed sidebar, naming it on hover', async () => {
    render(
      <SidebarProvider defaultState="collapsed">
        <FactorySessionsNav sessions={sessions} />
      </SidebarProvider>,
    );

    const login = screen.getByRole('link', { name: /Fix login/ });
    expect(login.querySelector('svg')).not.toBeNull();

    await userEvent.hover(login);

    expect((await screen.findByRole('tooltip')).textContent).toBe('Fix login');
  });

  it('tells the host when a session link is followed', () => {
    const onNavigate = vi.fn();
    render(<FactorySessionsNav sessions={sessions} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole('link', { name: 'Write docs' }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('announces what each busy session is doing, and nothing for an idle one', () => {
    render(
      <FactorySessionsNav
        sessions={[
          { id: 'setup', name: 'Set up repo', href: '/p/sessions/setup', status: 'initializing' },
          { id: 'login', name: 'Fix login', href: '/p/sessions/login', status: 'working' },
          { id: 'review', name: 'Review PR', href: '/p/sessions/review', status: 'ready' },
          { id: 'docs', name: 'Write docs', href: '/p/sessions/docs' },
        ]}
      />,
    );

    expect(screen.getAllByRole('status').map(belt => belt.getAttribute('aria-label'))).toEqual([
      'Initializing Set up repo',
      'Agent working in Fix login',
      'Review PR waiting on you',
    ]);
  });

  it('announces loading sessions, then an empty list', () => {
    const { rerender } = render(<FactorySessionsNav sessions={undefined} />);
    expect(screen.getByRole('status', { name: 'Loading sessions' })).toBeTruthy();

    rerender(<FactorySessionsNav sessions={[]} />);
    expect(screen.getByRole('status').textContent).toBe('No sessions yet');
  });

  it('reports a load failure, offering Retry only when the host can retry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<FactorySessionsNav sessions={undefined} error />);
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t load sessions');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    rerender(<FactorySessionsNav sessions={undefined} error onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
