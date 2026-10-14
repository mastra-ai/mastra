import { Sidebar, SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { SettingsNavigation } from '../../../settings/components/SettingsNavigation';
import { SidebarUserMenu } from '../SidebarUserMenu';
import { signedInAccount } from './fixtures/userMenu';

function CurrentPath() {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="Current path">{pathname + search + hash}</output>;
}

function renderUserMenu(initialEntry = '/factories/fp-1/work?status=active#sessions', collapsed = false) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SidebarProvider
        storageKey="sidebar-user-menu-test"
        mobileBreakpoint={0}
        defaultState={collapsed ? 'collapsed' : 'default'}
      >
        <Routes>
          <Route
            path="/factories/:factoryId/*"
            element={
              <>
                <Sidebar.NavList>
                  <SidebarUserMenu />
                </Sidebar.NavList>
                <Routes>
                  <Route path="settings/:section" element={<SettingsNavigation />} />
                  <Route path="*" element={<></>} />
                </Routes>
                <CurrentPath />
              </>
            }
          />
        </Routes>
      </SidebarProvider>
    </MemoryRouter>,
  );
}

function stubSignedIn() {
  server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json(signedInAccount)));
}

describe('SidebarUserMenu', () => {
  it('opens a menu without navigating and exposes personal settings, Factory settings, and logout', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderUserMenu();

    const trigger = await screen.findByRole('button', { name: 'User menu' });
    expect(trigger).toHaveTextContent('Dev');
    await user.click(trigger);

    const menu = await screen.findByRole('menu', { name: 'User menu' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['My account', 'Preferences', 'Your models', 'Your memory', 'Connections', 'Settings', 'Log out']);
    expect(within(menu).getByRole('menuitem', { name: 'Log out' })).toHaveAttribute(
      'href',
      `${TEST_BASE_URL}/auth/logout`,
    );
    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent(
      '/factories/fp-1/work?status=active#sessions',
    );
  });

  it.each([
    ['My account', 'account'],
    ['Preferences', 'preferences'],
    ['Your models', 'personal-models'],
    ['Your memory', 'memory'],
    ['Connections', 'connections'],
    ['Settings', 'models'],
  ])('opens %s directly and closes the dropdown', async (label, section) => {
    const user = userEvent.setup();
    stubSignedIn();
    renderUserMenu();

    await user.click(await screen.findByRole('button', { name: 'User menu' }));
    await user.click(await screen.findByRole('menuitem', { name: label }));

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent(
      `/factories/fp-1/settings/${section}`,
    );
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('returns to the original page after switching settings through the menu', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderUserMenu();

    await user.click(await screen.findByRole('button', { name: 'User menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Preferences' }));
    await user.click(screen.getByRole('button', { name: 'User menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Back to app' }));

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent(
      '/factories/fp-1/work?status=active#sessions',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'User menu' })).toHaveFocus());
  });

  it('falls back to the factory home when settings was opened from a deep link', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderUserMenu('/factories/fp-1/settings/account');

    await user.click(await screen.findByRole('button', { name: 'User menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Back to app' }));

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent(/^\/factories\/fp-1$/);
  });

  it('supports keyboard access and Escape when the sidebar is collapsed', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderUserMenu(undefined, true);

    const trigger = await screen.findByRole('button', { name: 'User menu' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'My account' })).toHaveFocus();
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it.each([404, 401, 500])('keeps settings available without a signed-in account (HTTP %s)', async status => {
    const user = userEvent.setup();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => new HttpResponse(null, { status })));
    renderUserMenu();

    await user.click(await screen.findByRole('button', { name: 'Settings menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'My account' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Log out' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent('/factories/fp-1/settings/models');
  });
});
