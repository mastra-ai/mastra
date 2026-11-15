// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SidebarNavLabel } from './sidebar-nav-label';
import { SidebarNavAction, SidebarNavLink } from './sidebar-nav-link';

afterEach(() => cleanup());

const row = (state: 'default' | 'collapsed', description: React.ReactNode) => (
  <ul>
    <SidebarNavLink
      state={state}
      action={<SidebarNavAction aria-label="Actions for Fix flaky login" />}
      render={
        <a href="/sessions/1">
          <SidebarNavLabel state={state} description={description}>
            Fix flaky login
          </SidebarNavLabel>
        </a>
      }
    />
  </ul>
);

const time = <time dateTime="2026-11-10T10:00:00Z">3h</time>;

describe('SidebarNavLabel description', () => {
  it('shows the description under the label in an expanded sidebar', () => {
    render(row('default', time));

    expect(screen.getByRole('link', { name: /Fix flaky login/ }).textContent).toBe('Fix flaky login3h');
    expect(screen.getByRole('button', { name: 'Actions for Fix flaky login' })).toBeTruthy();
  });

  it('drops the description when the sidebar collapses to icons', () => {
    render(row('collapsed', time));

    expect(screen.getByRole('link', { name: 'Fix flaky login' }).textContent).toBe('Fix flaky login');
  });

  it('renders a falsy description such as 0, but not false or null', () => {
    const { rerender } = render(row('default', 0));
    expect(screen.getByRole('link').textContent).toBe('Fix flaky login0');

    rerender(row('default', false));
    expect(screen.getByRole('link').textContent).toBe('Fix flaky login');
    expect(screen.getByRole('link').querySelector('[data-slot="sidebar-nav-description"]')).toBeNull();
  });
});
