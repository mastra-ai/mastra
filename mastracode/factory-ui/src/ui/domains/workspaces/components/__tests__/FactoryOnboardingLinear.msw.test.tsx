/**
 * Onboarding's Work step connecting Linear. A Platform server connects in a
 * Mastra Connect popup, so the page stays put and never stores a resume marker
 * for a redirect it didn't make.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ONBOARDING_DRAFT_KEY, ONBOARDING_STEP_KEY } from '../../services/onboardingFlow';
import { FactoryOnboarding } from '../FactoryOnboarding';

const nangoAuths: string[] = [];
vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string) {
      nangoAuths.push(integrationId);
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

const repository = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

beforeEach(() => {
  nangoAuths.length = 0;
  sessionStorage.clear();
  sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify({ repository }));
  sessionStorage.setItem(ONBOARDING_STEP_KEY, 'project-management');
});

afterEach(() => sessionStorage.clear());

describe('FactoryOnboarding Linear', () => {
  it('connects Linear through Mastra Connect on a Platform server and shows it connected in place', async () => {
    let connected = false;
    const sessions: string[] = [];
    const root = `${TEST_BASE_URL}/web/integrations/platform/linear`;
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json(
          connected
            ? {
                enabled: true,
                connected: true,
                reason: 'ready',
                mode: 'platform',
                workspace: { name: 'Acme', urlKey: 'acme' },
              }
            : { enabled: true, connected: false, reason: 'not_connected', mode: 'platform', workspace: null },
        ),
      ),
      http.post(`${root}/connect-session`, () => {
        connected = true;
        sessions.push('connect');
        return HttpResponse.json(
          {
            connectionId: 'linear-new',
            integrationId: 'linear',
            connectUrl: 'https://example.com/consent',
            sessionToken: 'session-token',
            expiresAt: '2099-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
      http.get(`${root}/connections`, () =>
        HttpResponse.json({
          connections: [{ id: 'linear-new', integrationId: 'linear', status: 'active', accountLabel: 'Acme' }],
        }),
      ),
    );
    renderWithProviders(
      <MemoryRouter>
        <FactoryOnboarding local={false} onDismissGithubCallback={() => {}} />
      </MemoryRouter>,
    );
    sessionStorage.removeItem(ONBOARDING_STEP_KEY);

    await userEvent.click(await screen.findByRole('button', { name: /Connect Linear/ }));

    expect(await screen.findByText('Connected to Acme.')).toBeInTheDocument();
    expect(sessions).toEqual(['connect']);
    expect(nangoAuths).toEqual(['linear']);
    expect(sessionStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
  });
});
