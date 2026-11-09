import { Sidebar, SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { SettingsNavigation } from '../../../settings/components/SettingsNavigation';
import { SidebarSettingsLink } from '../SidebarSettingsLink';
import { signedIn } from './fixtures/auth';

const avatarUrl = 'https://avatars.example/dev.png';

function CurrentPath() {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="Current path">{pathname + search + hash}</output>;
}

function renderSettingsLink(initialEntry = '/factories/fp-1/work?status=active#sessions', collapsed = false) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SidebarProvider
        storageKey="sidebar-settings-link-test"
        mobileBreakpoint={0}
        defaultState={collapsed ? 'collapsed' : 'default'}
      >
        <Routes>
          <Route
            path="/factories/:factoryId/*"
            element={
              <>
                <Sidebar.NavList>
                  <SidebarSettingsLink />
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
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ ...signedIn, user: { ...signedIn.user, avatarUrl } }),
    ),
  );
}

function currentPath() {
  return screen.getByRole('status', { name: 'Current path' });
}

describe('SidebarSettingsLink', () => {
  it('shows the signed-in user and opens settings on click', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderSettingsLink();

    const link = await screen.findByRole('link', { name: 'Settings for Dev' });
    expect(link).toHaveTextContent('Dev');
    expect(link).not.toHaveTextContent('dev@mastra.ai');
    expect(within(link).getByRole('img', { name: 'Dev' })).toHaveAttribute('src', avatarUrl);
    await user.click(link);

    expect(currentPath()).toHaveTextContent('/factories/fp-1/settings/preferences');
    expect(screen.getByRole('link', { name: 'Settings for Dev' })).toHaveAttribute('aria-current', 'page');
  });

  it('uses the email and an initial when the profile has no name or image', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({ ...signedIn, user: { ...signedIn.user, name: '' } }),
      ),
    );
    renderSettingsLink();

    const link = await screen.findByRole('link', { name: 'Settings for dev@mastra.ai' });
    expect(within(link).getByText('D')).toBeInTheDocument();
    expect(within(link).queryByRole('img')).not.toBeInTheDocument();
  });

  it('returns to the original page after switching sections and reopening settings', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderSettingsLink();

    await user.click(await screen.findByRole('link', { name: 'Settings for Dev' }));
    await user.click(screen.getByRole('link', { name: 'My account' }));
    await user.click(screen.getByRole('link', { name: 'Settings for Dev' }));
    await user.click(screen.getByRole('button', { name: 'Back to app' }));

    expect(currentPath()).toHaveTextContent('/factories/fp-1/work?status=active#sessions');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Settings for Dev' })).toHaveFocus());
  });

  it('falls back to the factory home when settings was opened from a deep link', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderSettingsLink('/factories/fp-1/settings/account');

    await user.click(await screen.findByRole('link', { name: 'Settings for Dev' }));
    await user.click(screen.getByRole('button', { name: 'Back to app' }));

    expect(currentPath()).toHaveTextContent(/^\/factories\/fp-1$/);
  });

  it('opens settings from the keyboard when the sidebar is collapsed', async () => {
    const user = userEvent.setup();
    stubSignedIn();
    renderSettingsLink(undefined, true);

    const link = await screen.findByRole('link', { name: 'Settings for Dev' });
    link.focus();
    await user.keyboard('{Enter}');

    expect(currentPath()).toHaveTextContent('/factories/fp-1/settings/preferences');
  });

  it.each([404, 401, 500])('keeps settings available without a signed-in account (HTTP %s)', async status => {
    const user = userEvent.setup();
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => new HttpResponse(null, { status })));
    renderSettingsLink();

    await user.click(await screen.findByRole('link', { name: 'Settings' }));

    expect(currentPath()).toHaveTextContent('/factories/fp-1/settings/preferences');
  });
});
