import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { SidebarAccountLink } from '../SidebarAccountLink';

function CurrentPath() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}

function renderAccountLink() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/work']}>
      <MainSidebarProvider storageKey="sidebar-account-link-test" mobileBreakpoint={0}>
        <Routes>
          <Route
            path="/factories/:factoryId/*"
            element={
              <>
                <SidebarAccountLink />
                <CurrentPath />
              </>
            }
          />
        </Routes>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('SidebarAccountLink', () => {
  it('opens My account instead of logging out', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${TEST_BASE_URL}/auth/me`, () =>
        HttpResponse.json({
          authenticated: true,
          user: { userId: 'user-1', email: 'dev@mastra.ai', name: 'Dev' },
          provider: 'workos',
        }),
      ),
    );

    renderAccountLink();

    const accountLink = await screen.findByRole('link', { name: 'My account' });
    expect(accountLink).toHaveTextContent('Dev');

    await user.click(accountLink);

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent('/factories/fp-1/settings/account');
  });
});
