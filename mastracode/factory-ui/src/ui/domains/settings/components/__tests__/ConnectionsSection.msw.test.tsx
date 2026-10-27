import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../../factory/services/platformConnect';
import type { GithubStatus } from '../../../workspaces/services/github';
import { ConnectionsSection } from '../ConnectionsSection';

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

beforeEach(() => {
  authCalls.length = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
      HttpResponse.json({ accounts: [], canConnect: false, reason: 'not_registered' }),
    ),
    http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
      HttpResponse.json({ enabled: false, configured: false, reason: 'missing_config' }),
    ),
  );
});

function renderConnections(path = '/factories/fp-1/settings/connections') {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/connections" element={<ConnectionsSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

function platformAccounts(provider: PlatformConnectProviderId, initialConnections: PlatformProviderConnection[]) {
  const connections = [...initialConnections];
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

const githubConnected: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
  userConnected: true,
  userGithubUsername: 'ada',
  reason: 'ready',
};

function githubTokens(configured = false) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(githubConnected)),
    http.get(`${TEST_BASE_URL}/web/github/pat`, () => HttpResponse.json({ configured, reviewerConfigured: false })),
  );
}

describe('Connections settings', () => {
  it.each([
    { status: 404, retryable: false },
    { status: 503, retryable: true },
  ])(
    'distinguishes an absent GitLab integration from a failed connection request ($status)',
    async ({ status, retryable }) => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/gitlab/status`, () => HttpResponse.json({ error: 'unavailable' }, { status })),
      );
      renderConnections();
      await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
      const label = await screen.findByText('GitLab');
      const row = label.closest<HTMLElement>('[data-slot="settings-row"]');
      if (!row) throw new Error('GitLab connection row is missing');
      const retry = within(row).queryByRole('button', { name: 'Retry' });
      if (!retryable) {
        expect(retry).not.toBeInTheDocument();
        expect(within(row).queryByRole('button', { name: 'Connect GitLab' })).not.toBeInTheDocument();
        return;
      }
      expect(retry).toBeEnabled();
      server.use(
        http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
          HttpResponse.json({
            enabled: true,
            configured: false,
            mode: 'platform',
            connections: [],
            accounts: [],
            reauthRequired: false,
          }),
        ),
      );
      await userEvent.click(within(row).getByRole('button', { name: 'Retry' }));
      expect(await screen.findByRole('button', { name: 'Connect GitLab' })).toBeEnabled();
    },
  );

  it('separates the personal GitHub identity from organization installation management and CLI tokens', async () => {
    githubTokens();
    renderConnections();

    const personal = screen.getByRole('region', { name: 'Connected accounts' });
    expect(await within(personal).findByText('@ada')).toBeInTheDocument();
    const organization = screen.getByRole('region', { name: 'Organization connections' });
    expect(await within(organization).findByText('acme')).toBeInTheDocument();
    expect(within(organization).getByRole('button', { name: 'Manage GitHub connection' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'GitHub CLI tokens' })).toBeInTheDocument();
    expect(screen.queryByText('GitHub account')).not.toBeInTheDocument();
  });

  it('given only a hidden personal GitHub account install, when connections render, then the organization row explains it and offers a GitHub organization install', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: false,
          installations: [],
          reason: 'personal_install_hidden',
          hiddenPersonalInstallReason: 'personal_install_requires_single_member_org',
        } satisfies GithubStatus),
      ),
      http.get(`${TEST_BASE_URL}/web/github/pat`, () =>
        HttpResponse.json({ configured: false, reviewerConfigured: false }),
      ),
    );
    renderConnections();

    const organization = screen.getByRole('region', { name: 'Organization connections' });
    expect(await within(organization).findByText(/installed on a personal GitHub account/)).toBeInTheDocument();
    expect(within(organization).getByRole('button', { name: 'Install on a GitHub organization' })).toBeInTheDocument();
  });

  it('given a personal GitHub account install whose linker left the platform org, when connections render, then the organization row says why and offers a GitHub organization install', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: false,
          installations: [],
          unusableInstallations: [
            {
              installationId: 9,
              accountLogin: 'ada',
              accountType: 'User',
              unusableReason: 'linker_not_organization_member',
            },
          ],
          reason: 'installations_unusable',
        } satisfies GithubStatus),
      ),
      http.get(`${TEST_BASE_URL}/web/github/pat`, () =>
        HttpResponse.json({ configured: false, reviewerConfigured: false }),
      ),
    );
    renderConnections();

    const organization = screen.getByRole('region', { name: 'Organization connections' });
    expect(await within(organization).findByText(/left this platform org/)).toBeInTheDocument();
    expect(within(organization).getByRole('button', { name: 'Install on a GitHub organization' })).toBeInTheDocument();
  });

  it.each(['gitlab', 'jira'] as const)(
    'keeps every %s account reconnectable and adds accounts only after disclosure',
    async provider => {
      const minted = platformAccounts(provider, [
        { id: 'healthy', integrationId: provider, status: 'active', accountLabel: 'Healthy account' },
        { id: 'expired', integrationId: provider, status: 'needs_reauth', accountLabel: 'Expired account' },
      ]);
      const name = provider === 'gitlab' ? 'GitLab' : 'Jira';
      renderConnections();

      expect(await screen.findByText('Healthy account')).toBeInTheDocument();
      expect(screen.getByText('Expired account')).toBeInTheDocument();
      expect(screen.getByText('Needs reauthorization')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Connect another ${name} account` })).not.toBeInTheDocument();
      const expiredRow = screen.getByText('Expired account').closest<HTMLElement>('[data-slot="settings-row"]');
      if (!expiredRow) throw new Error('Expired account row is missing');
      await userEvent.click(within(expiredRow).getByRole('button', { name: `Reconnect ${name}` }));
      await waitFor(() => expect(minted).toEqual([{ kind: 'reconnect', id: 'expired' }]));
      await waitFor(() => expect(screen.queryByText('Needs reauthorization')).not.toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
      await userEvent.click(screen.getByRole('button', { name: `Connect another ${name} account` }));
      expect(await screen.findByText('New account')).toBeInTheDocument();
      expect(authCalls).toEqual([
        { integrationId: provider, options: { detectClosedAuthWindow: true } },
        { integrationId: provider, options: { detectClosedAuthWindow: true } },
      ]);
      if (provider === 'gitlab') {
        expect(screen.getByRole('link', { name: 'Manage GitLab connection' })).toHaveAttribute(
          'href',
          'https://projects.mastra.ai',
        );
      }
      expect(screen.queryByRole('region', { name: 'GitHub CLI tokens' })).not.toBeInTheDocument();
    },
  );

  it('collects an incident.io key and connects it without a consent popup', async () => {
    platformAccounts('incident-io', []);
    renderConnections();
    await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Connect incident.io' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('incident.io API key'), 'incident-secret');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    expect(await screen.findByText('New account')).toBeInTheDocument();
    expect(authCalls).toEqual([
      { integrationId: 'incident-io', options: { credentials: { apiKey: 'incident-secret' } } },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps a deployment-managed incident.io credential visible without a competing connect action', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' }),
      ),
    );
    renderConnections();
    expect(await screen.findByText('API key configured on this server.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
    expect(screen.queryByRole('button', { name: 'Connect incident.io' })).not.toBeInTheDocument();
  });

  it('offers a retry instead of a connect action when the incident.io status fails', async () => {
    platformAccounts('incident-io', []);
    let statusRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => {
        statusRequests += 1;
        if (statusRequests === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json({ enabled: true, configured: true, mode: 'api-key', reason: 'ready' });
      }),
    );
    renderConnections();

    expect(await screen.findByText("Couldn't load incident.io status.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
    expect(screen.queryByRole('button', { name: 'Connect incident.io' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('API key configured on this server.')).toBeInTheDocument();
  });

  it('treats a missing incident.io status route as not configured instead of an error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () => new HttpResponse(null, { status: 404 })),
      http.get(
        `${TEST_BASE_URL}/web/integrations/platform/incident-io/connections`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    renderConnections();

    await waitFor(() => expect(screen.queryByLabelText('Loading incident.io connections')).not.toBeInTheDocument());
    expect(screen.queryByText("Couldn't load incident.io status.")).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByText('incident.io')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
    expect(await screen.findByText('incident.io')).toBeInTheDocument();
  });

  it('does not present a disabled direct Jira credential as deployment-managed', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
        HttpResponse.json({ enabled: false, configured: true, mode: 'direct', reason: 'missing_config' }),
      ),
    );
    renderConnections();

    expect(await screen.findByRole('button', { name: 'Add connection' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText('Loading Jira connections')).not.toBeInTheDocument());
    expect(screen.queryByText('Managed by deployment environment variables.')).not.toBeInTheDocument();
  });

  it.each([
    {
      provider: 'Linear',
      path: 'linear/status',
      ready: { enabled: true, connected: true, workspace: { name: 'Acme workspace', urlKey: 'acme' }, reason: 'ready' },
      connected: 'Acme workspace',
    },
    {
      provider: 'Jira',
      path: 'jira/status',
      ready: { enabled: true, configured: true, mode: 'direct', reason: 'ready' },
      connected: 'Managed by deployment environment variables.',
    },
  ])(
    'offers a retry instead of "not configured" when the $provider status fails',
    async ({ provider, path, ready, connected }) => {
      let statusRequests = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/web/${path}`, () => {
          statusRequests += 1;
          if (statusRequests === 1) return new HttpResponse(null, { status: 503 });
          return HttpResponse.json(ready);
        }),
      );
      renderConnections();

      expect(await screen.findByText(`Couldn't load ${provider} connections.`)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Add connection' }));
      expect(screen.getAllByText(provider)).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText(connected)).toBeInTheDocument();
    },
  );

  it('opens the add list when linked from Work Intake', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, workspace: null }),
      ),
    );
    renderConnections('/factories/fp-1/settings/connections?add=1');

    expect(await screen.findByRole('button', { name: 'Connect Linear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('shows the Linear workspace with its existing reconnect flow', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          workspace: { name: 'Acme workspace', urlKey: 'acme' },
          reason: 'ready',
        }),
      ),
    );
    renderConnections();
    expect(await screen.findByText('Acme workspace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect Linear' })).toBeInTheDocument();
  });

  it('preserves a failed token draft for retry, then removes the saved worker token', async () => {
    githubTokens();
    let configured = false;
    let rejectSave = true;
    const saved: unknown[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/pat`, () => HttpResponse.json({ configured, reviewerConfigured: false })),
      http.post(`${TEST_BASE_URL}/web/github/pat`, async ({ request }) => {
        saved.push(await request.json());
        if (rejectSave) return HttpResponse.json({ error: 'Token rejected' }, { status: 400 });
        configured = true;
        return HttpResponse.json({ ok: true });
      }),
      http.delete(`${TEST_BASE_URL}/web/github/pat`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('kind')).toBe('default');
        configured = false;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderConnections();
    const tokens = await screen.findByRole('region', { name: 'GitHub CLI tokens' });
    const workerRow = (await within(tokens).findByText('Worker token')).closest<HTMLElement>(
      '[data-slot="settings-row"]',
    );
    if (!workerRow) throw new Error('Worker token row is missing');
    expect(within(workerRow).getByText('Not set')).toBeInTheDocument();
    await userEvent.click(within(workerRow).getByRole('button', { name: 'Add token' }));
    const input = screen.getByLabelText('Worker token GitHub Personal Access Token');
    await userEvent.type(input, 'worker-secret');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Token rejected')).toBeInTheDocument();
    expect(input).toHaveValue('worker-secret');
    rejectSave = false;
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    const updateToken = await screen.findByRole('button', { name: 'Update token' });
    expect(within(tokens).getByText('Configured')).toBeInTheDocument();
    await waitFor(() => expect(updateToken).toHaveFocus());
    expect(screen.queryByLabelText('Worker token GitHub Personal Access Token')).not.toBeInTheDocument();
    expect(saved).toEqual([
      { token: 'worker-secret', kind: 'default' },
      { token: 'worker-secret', kind: 'default' },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(within(tokens).getAllByRole('button', { name: 'Add token' })).toHaveLength(2));
  });
});
