/**
 * BDD coverage for the personal GitHub authorization row.
 *
 * Drives the real status service and React Query stack; only the network is
 * mocked with MSW.
 */
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { GithubStatus } from '../../../workspaces/services/github';
import { UserGithubConnectionRow } from '../UserGithubConnectionRow';

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

    expect(
      await screen.findByText('Connect your GitHub account so issues and PRs you create are authored as you.'),
    ).toBeInTheDocument();
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
    expect(
      screen.queryByText('Connect your GitHub account so issues and PRs you create are authored as you.'),
    ).not.toBeInTheDocument();
  });
});
