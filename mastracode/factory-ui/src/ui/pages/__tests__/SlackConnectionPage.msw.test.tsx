import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../e2e/ui/render';
import type { ConnectedChannelAccount } from '../../domains/settings/services/channelAccounts';
import { SlackConnectionPage } from '../SlackConnectionPage';

const slackLink: ConnectedChannelAccount = {
  platform: 'slack',
  externalTeamId: 'T06CB4A5FT9',
  externalUserId: 'U095PUH0FKL',
  externalTeamName: 'Mastra',
  externalUserName: 'Caleb Barnes',
  defaultFactoryProjectId: 'fp-1',
  linkedAt: '2026-07-29T15:14:00.000Z',
};

function mockAccounts(accounts: ConnectedChannelAccount[], canConnect = true) {
  server.use(http.get(`${TEST_BASE_URL}/web/channel-accounts`, () => HttpResponse.json({ accounts, canConnect })));
}

function mockFactories() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: 'fp-1', name: 'OM Game' },
          { id: 'fp-2', name: 'Mastra OSS' },
        ],
      }),
    ),
  );
}

function renderPage() {
  mockFactories();
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/connected-accounts/slack']}>
      <MainSidebarProvider storageKey="slack-connection-page-test" mobileBreakpoint={0}>
        <Routes>
          <Route
            path="/factories/:factoryId/settings/connected-accounts/slack"
            element={<SlackConnectionPage />}
          />
        </Routes>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('SlackConnectionPage', () => {
  it('given a linked account, when rendered, then it identifies the workspace, user, link date, and default factory', async () => {
    mockAccounts([slackLink]);

    renderPage();

    expect(await screen.findByText('Mastra (T06CB4A5FT9)')).toBeInTheDocument();
    expect(screen.getByText('Caleb Barnes (U095PUH0FKL)')).toBeInTheDocument();
    expect(screen.getByText(/July 29, 2026/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default factory' })).toHaveTextContent('OM Game');
  });

  it('given no linked account, when rendered, then it offers Slack authentication', async () => {
    mockAccounts([]);

    renderPage();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Slack' })).toBeEnabled();
  });

  it('given a linked account, when disconnected, then it sends the sender key and returns to the connect state', async () => {
    let listCalls = 0;
    let deleteBody: unknown;
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () => {
        listCalls += 1;
        return HttpResponse.json({ accounts: listCalls === 1 ? [slackLink] : [], canConnect: true });
      }),
      http.delete(`${TEST_BASE_URL}/web/channel-accounts`, async ({ request }) => {
        deleteBody = await request.json();
        return HttpResponse.json({ deleted: true });
      }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Disconnect' }));

    await waitFor(() =>
      expect(deleteBody).toEqual({
        platform: 'slack',
        externalTeamId: 'T06CB4A5FT9',
        externalUserId: 'U095PUH0FKL',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Connect Slack' })).toBeEnabled();
  });

  it('given a linked account, when its default factory changes, then the sender routing is updated', async () => {
    let patchBody: unknown;
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.json({ accounts: [slackLink], canConnect: true }),
      ),
      http.patch(`${TEST_BASE_URL}/web/channel-accounts/default-factory`, async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({ updated: true });
      }),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Default factory' }));
    await user.click(await screen.findByRole('option', { name: 'Mastra OSS' }));

    await waitFor(() =>
      expect(patchBody).toEqual({
        platform: 'slack',
        externalTeamId: 'T06CB4A5FT9',
        externalUserId: 'U095PUH0FKL',
        factoryProjectId: 'fp-2',
      }),
    );
  });
});
