/**
 * BDD coverage for Settings › General › Connected accounts.
 *
 * Drives the real channel-accounts service and React Query stack; only the
 * network is mocked with MSW.
 */
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { ConnectedChannelAccount } from '../../services/channelAccounts';
import { ConnectedAccountsSection } from '../ConnectedAccountsSection';

const slackLink: ConnectedChannelAccount = {
  platform: 'slack',
  externalTeamId: 'T06CB4A5FT9',
  externalUserId: 'U095PUH0FKL',
  linkedAt: '2026-07-23T17:57:43.368Z',
};

function mockAccounts(accounts: ConnectedChannelAccount[], canConnect = false) {
  server.use(http.get(`${TEST_BASE_URL}/web/channel-accounts`, () => HttpResponse.json({ accounts, canConnect })));
}

describe('ConnectedAccountsSection', () => {
  it('given no links and no OIDC config, when rendered, then it explains how linking starts from Slack', async () => {
    mockAccounts([]);

    renderWithProviders(<ConnectedAccountsSection />);

    expect(await screen.findByText(/Message the bot in Slack/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disconnect/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Slack/ })).not.toBeInTheDocument();
  });

  it('given no links and OIDC configured, when rendered, then it offers a Connect Slack button', async () => {
    mockAccounts([], true);

    renderWithProviders(<ConnectedAccountsSection />);

    expect(await screen.findByRole('button', { name: 'Connect Slack' })).toBeInTheDocument();
    expect(screen.queryByText(/Message the bot in Slack/)).not.toBeInTheDocument();
  });

  it('given a linked account and OIDC configured, when rendered, then it offers connecting another account', async () => {
    mockAccounts([slackLink], true);

    renderWithProviders(<ConnectedAccountsSection />);

    expect(await screen.findByText('Slack · U095PUH0FKL in T06CB4A5FT9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect another Slack account' })).toBeInTheDocument();
  });

  it('given a link with display names, when rendered, then it shows names instead of ids', async () => {
    mockAccounts([{ ...slackLink, externalTeamName: 'Kepler', externalUserName: 'Caleb Barnes' }]);

    renderWithProviders(<ConnectedAccountsSection />);

    expect(await screen.findByText('Slack · Caleb Barnes in Kepler')).toBeInTheDocument();
    expect(screen.queryByText(/U095PUH0FKL/)).not.toBeInTheDocument();
  });

  it('given a linked Slack account, when rendered, then it shows the identity with a disconnect action', async () => {
    mockAccounts([slackLink]);

    renderWithProviders(<ConnectedAccountsSection />);

    expect(await screen.findByText('Slack · U095PUH0FKL in T06CB4A5FT9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/ })).toBeInTheDocument();
  });

  it('given a linked account, when disconnected, then the sender key is sent and the list refreshes empty', async () => {
    let listCalls = 0;
    let deleteBody: unknown;
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () => {
        listCalls += 1;
        return HttpResponse.json({ accounts: listCalls === 1 ? [slackLink] : [], canConnect: false });
      }),
      http.delete(`${TEST_BASE_URL}/web/channel-accounts`, async ({ request }) => {
        deleteBody = await request.json();
        return HttpResponse.json({ deleted: true });
      }),
    );

    renderWithProviders(<ConnectedAccountsSection />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Disconnect/ }));

    await waitFor(() =>
      expect(deleteBody).toEqual({
        platform: 'slack',
        externalTeamId: 'T06CB4A5FT9',
        externalUserId: 'U095PUH0FKL',
      }),
    );
    // Refetch after invalidation renders the empty state.
    expect(await screen.findByText(/No connected accounts/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disconnect/ })).not.toBeInTheDocument();
  });

  it('given a delete that fails, when disconnected, then the row stays', async () => {
    mockAccounts([slackLink]);
    server.use(
      http.delete(`${TEST_BASE_URL}/web/channel-accounts`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );

    renderWithProviders(<ConnectedAccountsSection />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Disconnect/ }));

    expect(await screen.findByText('Slack · U095PUH0FKL in T06CB4A5FT9')).toBeInTheDocument();
  });
});
