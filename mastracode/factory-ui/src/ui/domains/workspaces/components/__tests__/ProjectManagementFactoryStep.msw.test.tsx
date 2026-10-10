import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ProjectManagementFactoryStep } from '../ProjectManagementFactoryStep';

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

  describe('given the Platform connect routes are mounted', () => {
    it('offers Jira and incident.io as equivalent choices beside Linear', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/jira/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({ connections: [] }),
        ),
      );
      renderStep();

      expect(await screen.findByRole('button', { name: 'Connect Jira' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Connect incident.io' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Connect Linear/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
      // The incident.io pane is scoped to follow-ups only.
      expect(screen.getByText(/incident follow-ups/i)).toBeInTheDocument();
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

    it('summarizes an active incident.io account', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`, () =>
          HttpResponse.json({
            connections: [{ id: 'c1_acme', integrationId: 'incident-io', status: 'active', accountLabel: 'acme' }],
          }),
        ),
      );
      renderStep();

      expect(await screen.findByText('incident.io connected')).toBeInTheDocument();
      expect(screen.getByText('Connected to acme.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });
  });
});

describe('Tracker connection recovery', () => {
  it.each([
    ['jira', 'Jira'],
    ['incident-io', 'incident.io'],
  ] as const)('keeps %s visible after a temporary failure and retries', async (provider, name) => {
    let calls = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/integrations/platform/${provider}/connections`, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        return HttpResponse.json({ connections: [] });
      }),
    );
    renderStep();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: `Retry ${name}` }));
    expect(await screen.findByRole('button', { name: `Connect ${name}` })).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it.each([
    ['jira', 'Jira'],
    ['incident-io', 'incident.io'],
  ] as const)('reauthorizes the existing %s connection instead of creating another', async (provider, name) => {
    const reconnects: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/integrations/platform/${provider}/connections`, () =>
        HttpResponse.json({
          connections: [
            { id: 'expired-account', integrationId: provider, status: 'needs_reauth', accountLabel: 'Acme' },
          ],
        }),
      ),
      http.post(
        `${TEST_BASE_URL}/web/integrations/platform/${provider}/connections/expired-account/reconnect-session`,
        ({ request }) => {
          reconnects.push(request.url);
          return HttpResponse.json({ error: 'Temporary outage' }, { status: 503 });
        },
      ),
    );
    renderStep();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: `Reconnect ${name}` }));
    if (provider === 'incident-io') {
      await user.type(screen.getByLabelText('incident.io API key'), 'demo-key');
      await user.click(screen.getByRole('button', { name: 'Connect' }));
    }
    await waitFor(() => expect(reconnects).toHaveLength(1));
    expect(screen.queryByRole('button', { name: `Connect ${name}` })).not.toBeInTheDocument();
  });
});
