/**
 * BDD coverage for the factory-scoped connections overview.
 * Drives the real channel-accounts service and React Query stack through MSW.
 */
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { ConnectedChannelAccount } from '../../services/channelAccounts';
import { ConnectedAccountsSection } from '../ConnectedAccountsSection';

const slackLink: ConnectedChannelAccount = {
  platform: 'slack',
  externalTeamId: 'T00000001',
  externalUserId: 'U00000001',
  externalTeamName: 'Example Workspace',
  externalUserName: 'Test User',
  linkedAt: '2026-01-15T12:00:00.000Z',
};

function mockAccounts(accounts: ConnectedChannelAccount[], canConnect = false) {
  server.use(http.get(`${TEST_BASE_URL}/web/channel-accounts`, () => HttpResponse.json({ accounts, canConnect })));
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/connections']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/connections" element={<ConnectedAccountsSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ConnectedAccountsSection', () => {
  // Modern factories answer the path with a stub when no Slack integration is
  // registered. Naming the env vars here would be a half-truth — they only
  // enable Slack in deployments whose entry registers SlackIntegration, which
  // the server can't see — so the card states the fact and stops there.
  it('given the server reports the Slack integration is not registered, when rendered, then it states the fact without naming env vars', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.json({ accounts: [], canConnect: false, reason: 'not_registered' }),
      ),
    );

    renderSection();

    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText(/Slack is not set up for this factory/)).toBeInTheDocument();
    expect(screen.queryByText(/SLACK_APP_SIGNING_SECRET/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect/ })).not.toBeInTheDocument();
  });

  // An old server has no channel route and no stub, so the SPA's index.html
  // answers instead. The old code fed that HTML to res.json() and rendered the
  // parse error ("Unexpected token '<'"); the not-configured card must stand in
  // for it.
  it('given an old server with no channel route, when rendered, then it shows the not-configured card instead of a parse error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.html('<!doctype html><html><body>app shell</body></html>'),
      ),
    );

    renderSection();

    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText(/Slack is not set up for this factory/)).toBeInTheDocument();
    expect(screen.queryByText(/^Missing required environment variables/)).not.toBeInTheDocument();
    expect(screen.queryByText(/is not valid JSON/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect/ })).not.toBeInTheDocument();
  });

  it('given a linked Slack account, when rendered, then it shows Slack as connected with a configure link', async () => {
    mockAccounts([slackLink], true);

    renderSection();

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    const slackRow = screen.getByRole('link', { name: /Slack.*Connected.*Configure/ });
    expect(slackRow).toHaveAttribute('href', '/factories/fp-1/settings/connections/slack');
    expect(slackRow).toHaveTextContent(/Slack.*Connected.*Configure/);
    expect(screen.queryByRole('button', { name: /Connect/ })).not.toBeInTheDocument();
  });

  it('given multiple linked Slack accounts, when rendered, then it shows the connected account count', async () => {
    mockAccounts([slackLink, { ...slackLink, externalTeamId: 'T00000002', externalUserId: 'U00000002' }]);

    renderSection();

    expect(await screen.findByText('2 connected')).toBeInTheDocument();
  });

  it('given no link and OIDC configured, when rendered, then it offers Slack connection', async () => {
    mockAccounts([], true);

    renderSection();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    const slackRow = screen.getByRole('button', { name: /Slack.*Not connected.*Connect/ });
    expect(slackRow).toBeEnabled();
    expect(slackRow).toHaveTextContent(/Slack.*Not connected.*Connect/);
  });

  it('given no link and no OIDC config, when rendered, then the connect action is unavailable', async () => {
    mockAccounts([]);

    renderSection();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Slack.*Not connected.*Connect/ })).toBeDisabled();
  });
});
