import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../../e2e/ui/render';
import type {
  PlatformConnectProviderId,
  PlatformProviderConnection,
} from '../../../../factory/services/platformConnect';
import {
  GITLAB_PROJECTS_URL,
  INTAKE_SOURCES_URL,
  JIRA_PROJECTS_URL,
  renderIntakeSection,
  useIntakeHandlers,
} from './fixtures';

const authCalls: Array<{ integrationId: string; options: Record<string, unknown> }> = [];
vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string, options: Record<string, unknown>) {
      authCalls.push({ integrationId, options });
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

function platformAccounts(provider: PlatformConnectProviderId, initial: PlatformProviderConnection[]) {
  const connections = [...initial];
  const minted: Array<{ kind: 'connect' | 'reconnect'; id: string }> = [];
  const root = `${TEST_BASE_URL}/web/integrations/platform/${provider}`;
  const session = (id: string) => ({
    connectionId: id,
    integrationId: provider,
    connectUrl: 'https://example.com/consent',
    sessionToken: 'session-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  server.use(
    http.get(`${root}/connections`, () => HttpResponse.json({ connections })),
    http.post(`${root}/connect-session`, () => {
      connections.push({ id: 'new-account', integrationId: provider, status: 'active', accountLabel: 'New account' });
      minted.push({ kind: 'connect', id: 'new-account' });
      return HttpResponse.json(session('new-account'), { status: 201 });
    }),
    http.post(`${root}/connections/:id/reconnect-session`, ({ params }) => {
      const id = String(params.id);
      const connection = connections.find(candidate => candidate.id === id);
      if (connection) connection.status = 'active';
      minted.push({ kind: 'reconnect', id });
      return HttpResponse.json(session(id), { status: 201 });
    }),
  );
  if (provider === 'gitlab' || provider === 'jira') {
    server.use(
      http.get(`${TEST_BASE_URL}/web/${provider}/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: connections.some(connection => connection.status === 'active'),
          mode: 'platform',
          connections,
          reauthRequired: connections.some(connection => connection.status === 'needs_reauth'),
          reason: 'ready',
        }),
      ),
    );
  }
  return minted;
}

const addSource = () => screen.getByRole('region', { name: 'Add a source' });

describe('IntakeSection connections', () => {
  beforeEach(() => {
    authCalls.length = 0;
    useIntakeHandlers();
    server.use(
      http.get(GITLAB_PROJECTS_URL, () => HttpResponse.json({ projects: [] })),
      http.get(JIRA_PROJECTS_URL, () => HttpResponse.json({ projects: [] })),
      http.get(INTAKE_SOURCES_URL, () => HttpResponse.json({ sources: [], failures: [] })),
    );
  });

  it.each([
    { provider: 'gitlab', name: 'GitLab' },
    { provider: 'jira', name: 'Jira' },
  ] as const)(
    'reconnects the expired $name account from its card and connects another from Add a source',
    async ({ provider, name }) => {
      const minted = platformAccounts(provider, [
        { id: 'healthy', integrationId: provider, status: 'active', accountLabel: 'Healthy account' },
        { id: 'expired', integrationId: provider, status: 'needs_reauth', accountLabel: 'Expired account' },
      ]);
      renderIntakeSection();

      const card = await screen.findByRole('region', { name });
      expect(within(card).getByRole('link', { name: `Manage ${name} connection` })).toHaveAttribute(
        'href',
        'https://projects.mastra.ai',
      );
      await userEvent.click(within(card).getByRole('button', { name: `Reconnect ${name}` }));
      await waitFor(() =>
        expect(within(card).queryByRole('button', { name: `Reconnect ${name}` })).not.toBeInTheDocument(),
      );

      await userEvent.click(within(addSource()).getByRole('button', { name: `Connect another ${name} account` }));
      await waitFor(() =>
        expect(minted).toEqual([
          { kind: 'reconnect', id: 'expired' },
          { kind: 'connect', id: 'new-account' },
        ]),
      );
      expect(authCalls).toEqual([
        { integrationId: provider, options: { detectClosedAuthWindow: true } },
        { integrationId: provider, options: { detectClosedAuthWindow: true } },
      ]);
    },
  );

  it('connects incident.io with an API key from Add a source and lists the new account in place', async () => {
    platformAccounts('incident-io', []);
    renderIntakeSection();

    await userEvent.click(
      within(await screen.findByRole('region', { name: 'Add a source' })).getByRole('button', {
        name: 'Connect incident.io',
      }),
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('incident.io API key'), 'incident-secret');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    const card = await screen.findByRole('region', { name: 'incident.io' });
    expect(await within(card).findByText('New account')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Manage incident.io connection' })).toHaveAttribute(
      'href',
      'https://projects.mastra.ai',
    );
    expect(within(addSource()).getByRole('button', { name: 'Connect another incident.io account' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Connect incident.io' })).not.toBeInTheDocument();
    expect(authCalls).toEqual([
      { integrationId: 'incident-io', options: { credentials: { apiKey: 'incident-secret' } } },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
