import { screen } from '@testing-library/react';
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
      expect(screen.getByText('user-1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy account ID' })).toBeInTheDocument();
      expect(screen.getByText('org-1')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy organization ID' })).toBeInTheDocument();
    });

    it('offers logout as an explicit session action', async () => {
      stubAuthenticatedAccount();

      renderWithProviders(<AccountSettingsSection />);

      expect(await screen.findByRole('button', { name: 'Log out of MastraCode' })).toBeInTheDocument();
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
});
