import { screen, within } from '@testing-library/react';
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
      expect(screen.queryByText('Also sync issues from')).not.toBeInTheDocument();
    });
  });

  describe('given Platform connect routes are mounted', () => {
    it('offers Jira and incident.io inline without leaving the wizard', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/jira/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
      );
      renderStep();

      expect(await screen.findByText('Also sync issues from')).toBeInTheDocument();
      const list = screen.getByRole('list');
      expect(within(list).getByText('Jira')).toBeInTheDocument();
      expect(within(list).getByText('incident.io')).toBeInTheDocument();
      expect(within(list).getAllByRole('button', { name: 'Connect' })).toHaveLength(2);
    });
  });
});
