import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { AccountSettingsSection } from '../AccountSettingsSection';

function stubAuthenticatedAccount() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        authenticated: true,
        user: {
          userId: 'user-1',
          email: 'dev@mastra.ai',
          name: 'Dev',
          organizationId: 'org-1',
        },
        provider: 'workos',
      }),
    ),
  );
}

describe('AccountSettingsSection', () => {
  describe('when the user is signed in', () => {
    it('shows the profile returned by the auth endpoint', async () => {
      stubAuthenticatedAccount();

      renderWithProviders(<AccountSettingsSection />);

      expect(await screen.findByText('Dev')).toBeInTheDocument();
      expect(screen.getByText('dev@mastra.ai')).toBeInTheDocument();
      expect(screen.getByText('WorkOS')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'account ID' })).toHaveTextContent('user-1');
      expect(screen.getByRole('button', { name: 'Copy account ID' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'organization ID' })).toHaveTextContent('org-1');
      expect(screen.getByRole('button', { name: 'Copy organization ID' })).toBeInTheDocument();
    });

    it('switches the theme from My account and remembers the choice', async () => {
      stubAuthenticatedAccount();
      const user = userEvent.setup();

      renderWithProviders(<AccountSettingsSection />);
      await screen.findByText('Dev');
      const theme = screen.getByRole('radiogroup', { name: 'Theme' });
      expect(within(theme).getByRole('radio', { name: 'System' })).toBeChecked();
      await user.click(within(theme).getByRole('radio', { name: 'Dark' }));

      expect(window.localStorage.getItem('mastracode.theme')).toBe('dark');
      expect(within(theme).getByRole('radio', { name: 'Dark' })).toBeChecked();
    });

    it('logs out by clearing MastraCode storage', async () => {
      stubAuthenticatedAccount();
      localStorage.setItem('mastracode.theme', 'dark');

      renderWithProviders(<AccountSettingsSection />);
      await userEvent.click(await screen.findByRole('button', { name: 'Log out of MastraCode' }));

      expect(localStorage.getItem('mastracode.theme')).toBeNull();
    });
  });

  describe('when authentication is disabled', () => {
    it('explains why account actions are unavailable', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json({ error: 'not_found' }, { status: 404 })),
      );

      renderWithProviders(<AccountSettingsSection />);

      expect(await screen.findByText('Authentication is not enabled for this deployment.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Log out of MastraCode' })).not.toBeInTheDocument();
    });
  });

  describe('when account details fail to load', () => {
    it('still lets the user change their theme and completion sound', async () => {
      server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => new HttpResponse(null, { status: 500 })));
      const user = userEvent.setup();

      renderWithProviders(<AccountSettingsSection />);
      await screen.findByText('Could not load your account details. Reload the page to try again.');
      await user.click(within(screen.getByRole('radiogroup', { name: 'Theme' })).getByRole('radio', { name: 'Light' }));

      expect(window.localStorage.getItem('mastracode.theme')).toBe('light');
      expect(screen.getByText('Completion sound')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Log out of MastraCode' })).not.toBeInTheDocument();
    });
  });
});
