import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GitLabConnection } from '../../../factory/services/gitlab';
import type { GithubStatus } from '../../../workspaces/services/github';
import { SourceControlConnections } from '../SourceControlConnections';

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

const GITLAB_STATUS_URL = `${TEST_BASE_URL}/web/gitlab/status`;
const PLATFORM_URL = `${TEST_BASE_URL}/web/integrations/platform`;

function githubStatus(status: GithubStatus) {
  server.use(http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(status)));
}

type GitLabProvider = 'gitlab' | 'gitlab-self-hosted';

/** The platform's two GitLab providers: `gitlab` lists both kinds of connection, `gitlab-self-hosted` its own. */
function gitlabAccounts(initial: GitLabConnection[]) {
  const connections = [...initial];
  const minted: Array<{ provider: GitLabProvider; kind: 'connect' | 'reconnect'; id: string }> = [];
  const listedBy = (provider: GitLabProvider) =>
    connections.filter(connection => provider === 'gitlab' || connection.integrationId === provider);
  const session = (provider: GitLabProvider, id: string) => ({
    connectionId: id,
    integrationId: provider,
    connectUrl: 'https://example.com/consent',
    sessionToken: 'session-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  server.use(
    http.get(GITLAB_STATUS_URL, () =>
      HttpResponse.json({
        enabled: true,
        configured: connections.some(connection => connection.status === 'active'),
        mode: 'platform',
        connections,
        reauthRequired: connections.some(connection => connection.status === 'needs_reauth'),
        reason: 'ready',
      }),
    ),
    http.get(`${PLATFORM_URL}/:provider/connections`, ({ params }) =>
      HttpResponse.json({ connections: listedBy(params.provider as GitLabProvider) }),
    ),
    http.post(`${PLATFORM_URL}/:provider/connect-session`, ({ params }) => {
      const provider = params.provider as GitLabProvider;
      const id = provider === 'gitlab' ? 'new-account' : 'new-self-hosted';
      const accountLabel = provider === 'gitlab' ? 'New account' : 'New instance';
      connections.push({ id, integrationId: provider, status: 'active', accountLabel });
      minted.push({ provider, kind: 'connect', id });
      return HttpResponse.json(session(provider, id), { status: 201 });
    }),
    http.post(`${PLATFORM_URL}/:provider/connections/:id/reconnect-session`, ({ params }) => {
      const provider = params.provider as GitLabProvider;
      const id = String(params.id);
      const connection = listedBy(provider).find(candidate => candidate.id === id);
      if (!connection) return HttpResponse.json({ error: 'connection_not_found' }, { status: 404 });
      connection.status = 'active';
      minted.push({ provider, kind: 'reconnect', id });
      const keep = provider === 'gitlab-self-hosted' ? { params: { hostname: 'gitlab.example.com' } } : {};
      return HttpResponse.json({ ...session(provider, id), ...keep }, { status: 201 });
    }),
  );
  return minted;
}

function renderSourceControl() {
  return renderWithProviders(
    <MemoryRouter>
      <SourceControlConnections />
    </MemoryRouter>,
  );
}

const sourceControl = () => screen.getByRole('region', { name: 'Source control' });
const rowOf = (text: string) => {
  const row = within(sourceControl()).getByText(text).closest<HTMLElement>('[data-slot="settings-item"]');
  if (!row) throw new Error(`${text} row is missing`);
  return row;
};

describe('Source control connections', () => {
  beforeEach(() => {
    authCalls.length = 0;
    githubStatus({ enabled: true, connected: false, installations: [], reason: 'ready' });
    gitlabAccounts([]);
  });

  it('offers Connect for GitHub while no installation exists', async () => {
    renderSourceControl();
    expect(await within(sourceControl()).findByRole('button', { name: 'Connect GitHub' })).toBeEnabled();
    expect(within(sourceControl()).queryByRole('button', { name: 'Manage GitHub connection' })).not.toBeInTheDocument();
  });

  it('lists GitHub installations with Manage instead of Connect once connected', async () => {
    githubStatus({
      enabled: true,
      connected: true,
      installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
      reason: 'ready',
    });
    renderSourceControl();
    expect(await within(sourceControl()).findByText('acme')).toBeInTheDocument();
    expect(within(rowOf('acme')).getByRole('button', { name: 'Manage GitHub connection' })).toBeEnabled();
    expect(within(sourceControl()).queryByRole('button', { name: 'Connect GitHub' })).not.toBeInTheDocument();
  });

  it.each([
    { status: 404, retryable: false },
    { status: 503, retryable: true },
  ])(
    'distinguishes an absent GitLab integration from a failed status request ($status)',
    async ({ status, retryable }) => {
      server.use(http.get(GITLAB_STATUS_URL, () => HttpResponse.json({ error: 'unavailable' }, { status })));
      renderSourceControl();
      await within(sourceControl()).findByText('GitLab');
      const row = rowOf('GitLab');
      const retry = within(row).queryByRole('button', { name: 'Retry' });
      if (!retryable) {
        expect(retry).not.toBeInTheDocument();
        expect(within(row).getByText('Not configured on this server.')).toBeInTheDocument();
        return;
      }
      expect(retry).toBeEnabled();
      gitlabAccounts([]);
      await userEvent.click(within(row).getByRole('button', { name: 'Retry' }));
      expect(await within(sourceControl()).findByRole('button', { name: 'Connect GitLab' })).toBeEnabled();
    },
  );

  it('offers Reconnect only on the GitLab account that needs it, and connects another account in place', async () => {
    const minted = gitlabAccounts([
      { id: 'healthy', integrationId: 'gitlab', status: 'active', accountLabel: 'Healthy account' },
      { id: 'expired', integrationId: 'gitlab', status: 'needs_reauth', accountLabel: 'Expired account' },
    ]);
    renderSourceControl();

    expect(await within(sourceControl()).findByText('Healthy account')).toBeInTheDocument();
    expect(within(rowOf('Healthy account')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(rowOf('Healthy account')).queryByRole('link')).not.toBeInTheDocument();
    const expiredRow = rowOf('Expired account');
    expect(within(expiredRow).getByText('Needs reauthorization')).toBeInTheDocument();
    expect(within(expiredRow).getByRole('link', { name: 'Manage GitLab connection' })).toHaveAttribute(
      'href',
      'https://projects.mastra.ai',
    );

    await userEvent.click(within(expiredRow).getByRole('button', { name: 'Reconnect GitLab' }));
    await waitFor(() => expect(minted).toEqual([{ provider: 'gitlab', kind: 'reconnect', id: 'expired' }]));
    await waitFor(() => expect(screen.queryByText('Needs reauthorization')).not.toBeInTheDocument());
    expect(within(sourceControl()).queryByRole('button', { name: 'Reconnect GitLab' })).not.toBeInTheDocument();

    await userEvent.click(within(sourceControl()).getByRole('button', { name: 'Add account to GitLab' }));
    expect(await within(sourceControl()).findByText('New account')).toBeInTheDocument();
    expect(within(rowOf('New account')).getByRole('link', { name: 'Manage GitLab connection' })).toBeInTheDocument();
    expect(within(sourceControl()).getAllByRole('link', { name: 'Manage GitLab connection' })).toHaveLength(1);
    expect(authCalls).toEqual([
      { integrationId: 'gitlab', options: { detectClosedAuthWindow: true } },
      { integrationId: 'gitlab', options: { detectClosedAuthWindow: true } },
    ]);
  });

  it('connects a self-hosted GitLab instance with its hostname and an access token', async () => {
    const minted = gitlabAccounts([]);
    renderSourceControl();

    await userEvent.click(await within(sourceControl()).findByRole('button', { name: 'Connect self-hosted GitLab' }));
    const dialog = await screen.findByRole('dialog', { name: 'Connect self-hosted GitLab' });
    const connect = within(dialog).getByRole('button', { name: 'Connect' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Instance hostname' }), ' gitlab.example.com ');
    expect(connect).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('self-hosted GitLab access token'), 'glpat-secret');
    await userEvent.click(connect);

    expect(await within(sourceControl()).findByText('New instance')).toBeInTheDocument();
    expect(minted).toEqual([{ provider: 'gitlab-self-hosted', kind: 'connect', id: 'new-self-hosted' }]);
    expect(authCalls).toEqual([
      {
        integrationId: 'gitlab-self-hosted',
        options: { credentials: { apiKey: 'glpat-secret' }, params: { hostname: 'gitlab.example.com' } },
      },
    ]);
  });

  it('reconnects an expired self-hosted connection on its own instance with its token form, not the gitlab.com popup', async () => {
    const minted = gitlabAccounts([
      { id: 'cloud', integrationId: 'gitlab', status: 'active', accountLabel: 'Cloud account' },
      { id: 'instance', integrationId: 'gitlab-self-hosted', status: 'needs_reauth', accountLabel: 'Instance' },
    ]);
    renderSourceControl();

    await userEvent.click(
      within(await waitFor(() => rowOf('Instance'))).getByRole('button', { name: 'Reconnect self-hosted GitLab' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Reconnect self-hosted GitLab' });
    // The instance is not the user's to change on reconnect: the server names it.
    expect(within(dialog).queryByRole('textbox', { name: 'Instance hostname' })).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('self-hosted GitLab access token'), 'glpat-rotated');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(screen.queryByText('Needs reauthorization')).not.toBeInTheDocument());
    expect(minted).toEqual([{ provider: 'gitlab-self-hosted', kind: 'reconnect', id: 'instance' }]);
    expect(authCalls).toEqual([
      {
        integrationId: 'gitlab-self-hosted',
        options: { credentials: { apiKey: 'glpat-rotated' }, params: { hostname: 'gitlab.example.com' } },
      },
    ]);
  });
});
