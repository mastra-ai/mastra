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
  externalTeamId: 'T06CB4A5FT9',
  externalUserId: 'U095PUH0FKL',
  externalTeamName: 'Mastra',
  externalUserName: 'Caleb Barnes',
  linkedAt: '2026-07-23T17:57:43.368Z',
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
    mockAccounts([slackLink, { ...slackLink, externalTeamId: 'T02SECOND', externalUserId: 'U02SECOND' }]);

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
