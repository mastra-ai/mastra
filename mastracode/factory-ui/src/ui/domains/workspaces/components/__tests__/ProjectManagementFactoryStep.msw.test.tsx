import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ProjectManagementFactoryStep } from '../ProjectManagementFactoryStep';

// The step never opens the popup itself in these specs, but the control it
// renders pulls in the SDK, which expects a browser window on import.
vi.mock('@nangohq/frontend', () => ({
  default: class MockNango {
    auth() {
      return Promise.resolve({});
    }
  },
  AuthError: class AuthError extends Error {
    type = 'unknown';
  },
}));

function renderStep() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, reason: 'not_connected' }),
    ),
  );
  return renderWithProviders(<ProjectManagementFactoryStep onConnect={() => {}} onContinue={() => {}} />);
}

describe('ProjectManagementFactoryStep', () => {
  describe('given the server has no Platform credentials', () => {
    it('shows only the Linear connect path', async () => {
      renderStep();

      expect(await screen.findByRole('button', { name: /Connect Linear/ })).toBeInTheDocument();
      expect(screen.queryByText('Connect Jira')).not.toBeInTheDocument();
    });
  });

  describe('given the Jira connect route is mounted', () => {
    it('offers Jira as an equivalent choice beside Linear', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/jira/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
      );
      renderStep();

      expect(await screen.findByRole('button', { name: 'Connect Jira' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect Linear/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
    });

    it('summarizes an active Jira account and unlocks Continue', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/jira/connections`, () =>
          HttpResponse.json({
            connections: [
              { id: 'a1b_acme', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
            ],
          }),
        ),
      );
      renderStep();

      expect(await screen.findByText('Jira connected')).toBeInTheDocument();
      expect(screen.getByText('Connected to acme.atlassian.net.')).toBeInTheDocument();
      // Additional accounts are managed in Settings, not during onboarding.
      expect(screen.queryByRole('button', { name: 'Connect another' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });
  });
});
