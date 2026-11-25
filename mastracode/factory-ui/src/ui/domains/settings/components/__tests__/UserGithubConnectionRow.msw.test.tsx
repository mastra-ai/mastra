/**
 * BDD coverage for the personal GitHub authorization row.
 *
 * Drives the real status service and React Query stack; only the network is
 * mocked with MSW.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { GithubStatus } from '../../../workspaces/services/github';
import type { OwnGithub } from '../../../workspaces/services/githubApps';
import { UserGithubConnectionRow } from '../UserGithubConnectionRow';

const authCalls: string[] = [];
vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string) {
      authCalls.push(integrationId);
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 7, accountLogin: 'octo', accountType: 'User' }],
  reason: 'ready',
};

function renderRow(status: GithubStatus) {
  server.use(http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(status)));
  return renderWithProviders(<UserGithubConnectionRow />);
}

describe('UserGithubConnectionRow', () => {
  it('given installations but no personal connection, when rendered, then it offers to connect the user', async () => {
    renderRow({ ...connectedStatus, userConnected: false, userGithubUsername: null });

    expect(await screen.findByText('Connect it so issues and PRs you create are authored as you.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect GitHub/ })).toBeInTheDocument();
  });

  it('given a personal connection, when rendered, then it shows the linked identity instead of the button', async () => {
    renderRow({ ...connectedStatus, userConnected: true, userGithubUsername: 'ada' });

    expect(await screen.findByText('@ada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
  });

  it('given a server without per-user connection support, when rendered, then no personal connection row appears', async () => {
    let statusRequested = false;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () => {
        statusRequested = true;
        return HttpResponse.json(connectedStatus);
      }),
    );

    renderWithProviders(<UserGithubConnectionRow />);

    await waitFor(() => expect(statusRequested).toBe(true));
    expect(screen.queryByRole('button', { name: /Connect GitHub/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Connect it so issues and PRs you create are authored as you.')).not.toBeInTheDocument();
  });
});

/** A user in an org on the Mastra Factory apps; their own connection and token live server-side. */
function serveOwnGithub(initial: OwnGithub) {
  const own = structuredClone(initial);
  const calls = { sessions: 0, savedTokens: [] as string[], deletes: 0 };
  server.use(
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ ...connectedStatus, mode: 'connect' } satisfies GithubStatus),
    ),
    http.get(`${TEST_BASE_URL}/web/github/user-connection`, () => HttpResponse.json(own)),
    http.post(`${TEST_BASE_URL}/web/github/user-connection/connect-session`, () => {
      calls.sessions += 1;
      own.connection = { id: 'conn-user', status: 'active', accountLabel: 'ada' };
      return HttpResponse.json(
        {
          connectionId: 'conn-user',
          integrationId: 'factory-github',
          connectUrl: 'https://example.com/consent',
          sessionToken: 'session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        { status: 201 },
      );
    }),
    http.post(`${TEST_BASE_URL}/web/github/user-pat`, async ({ request }) => {
      const { token } = (await request.json()) as { token: string };
      calls.savedTokens.push(token);
      if (token !== 'ghp_good')
        return HttpResponse.json({ error: 'invalid_token', message: 'GitHub rejected the token.' }, { status: 400 });
      own.pat = { configured: true, login: 'ada-pat' };
      return HttpResponse.json(own.pat);
    }),
    http.delete(`${TEST_BASE_URL}/web/github/user-pat`, () => {
      calls.deletes += 1;
      own.pat = { configured: false, login: null };
      return HttpResponse.json(own.pat);
    }),
  );
  return calls;
}

describe('UserGithubConnectionRow in an org on the Mastra Factory apps', () => {
  const nothing: OwnGithub = { connection: null, pat: { configured: false, login: null } };

  it('connects the user through the Mastra Factory app and then shows who they write as', async () => {
    authCalls.length = 0;
    const calls = serveOwnGithub(nothing);
    renderWithProviders(<UserGithubConnectionRow />);

    expect(
      await screen.findByText('Connect it, or add a token, so issues and PRs you create are authored as you.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));

    expect(await screen.findByText('@ada')).toBeInTheDocument();
    expect(calls.sessions).toBe(1);
    expect(authCalls).toEqual(['factory-github']);
    expect(screen.queryByRole('button', { name: 'Connect GitHub' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use a token' })).not.toBeInTheDocument();
  });

  it('saves a pasted token, shows it, and removes it', async () => {
    const calls = serveOwnGithub(nothing);
    renderWithProviders(<UserGithubConnectionRow />);

    await userEvent.click(await screen.findByRole('button', { name: 'Use a token' }));
    const dialog = await screen.findByRole('dialog', { name: 'Use a GitHub token' });
    await userEvent.type(within(dialog).getByLabelText('GitHub personal access token'), '  ghp_good ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('@ada-pat (personal access token)')).toBeInTheDocument();
    expect(calls.savedTokens).toEqual(['ghp_good']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove token' }));
    expect(
      await screen.findByText('Connect it, or add a token, so issues and PRs you create are authored as you.'),
    ).toBeInTheDocument();
    expect(calls.deletes).toBe(1);
  });

  it('keeps the dialog open when GitHub rejects the token', async () => {
    const calls = serveOwnGithub(nothing);
    renderWithProviders(<UserGithubConnectionRow />);

    await userEvent.click(await screen.findByRole('button', { name: 'Use a token' }));
    const dialog = await screen.findByRole('dialog', { name: 'Use a GitHub token' });
    await userEvent.type(within(dialog).getByLabelText('GitHub personal access token'), 'ghp_bad');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.savedTokens).toEqual(['ghp_bad']));
    expect(screen.getByRole('dialog', { name: 'Use a GitHub token' })).toBeInTheDocument();
    expect(screen.queryByText(/personal access token\)/)).not.toBeInTheDocument();
  });

  it('prefers the connection over a token and offers reconnecting an expired one', async () => {
    serveOwnGithub({
      connection: { id: 'conn-user', status: 'needs_reauth', accountLabel: 'ada' },
      pat: { configured: true, login: 'ada-pat' },
    });
    renderWithProviders(<UserGithubConnectionRow />);

    expect(await screen.findByText('Needs reauthorization')).toBeInTheDocument();
    expect(screen.getByText('@ada-pat (personal access token)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove token' })).toBeInTheDocument();
  });
});
