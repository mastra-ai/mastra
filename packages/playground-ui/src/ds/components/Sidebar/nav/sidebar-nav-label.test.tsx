// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SidebarNavLabel } from './sidebar-nav-label';
import { SidebarNavLink } from './sidebar-nav-link';

afterEach(() => cleanup());

const row = (state: 'default' | 'collapsed') => (
  <ul>
    <SidebarNavLink
      state={state}
      size="two-line"
      render={
        <a href="/sessions/1">
          <SidebarNavLabel state={state} description={<time dateTime="2026-11-10T10:00:00Z">3h</time>}>
            Fix flaky login
          </SidebarNavLabel>
        </a>
      }
    />
  </ul>
);

describe('SidebarNavLabel description', () => {
  it('shows the description under the label in an expanded sidebar', () => {
    render(row('default'));

    const link = screen.getByRole('link', { name: /Fix flaky login/ });
    expect(link.textContent).toBe('Fix flaky login3h');
    expect(link.className).toContain('min-h-control-lg');
  });

  it('drops the description and the grown row when the sidebar collapses to icons', () => {
    render(row('collapsed'));

    const link = screen.getByRole('link', { name: 'Fix flaky login' });
    expect(link.textContent).toBe('Fix flaky login');
    expect(link.className).toContain('h-control-md');
    expect(link.className).not.toContain('min-h-control-lg');
  });
});
