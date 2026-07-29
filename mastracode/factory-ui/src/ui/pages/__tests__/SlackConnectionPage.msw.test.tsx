import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
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

function mockFactories(slackWorkItemsEnabled = false) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: 'fp-1', name: 'OM Game', slackWorkItemsEnabled },
          { id: 'fp-2', name: 'Mastra OSS', slackWorkItemsEnabled: false },
        ],
      }),
    ),
  );
}

function renderPage(slackWorkItemsEnabled = false) {
  mockFactories(slackWorkItemsEnabled);
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/connections/slack']}>
      <MainSidebarProvider storageKey="slack-connection-page-test" mobileBreakpoint={0}>
        <Routes>
          <Route path="/factories/:factoryId/settings/connections/slack" element={<SlackConnectionPage />} />
        </Routes>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('SlackConnectionPage', () => {
  it('given a linked account, when rendered, then it identifies the workspace, user, link date, and default factory', async () => {
    mockAccounts([slackLink]);

    renderPage();
    const user = userEvent.setup();

    const connectionSection = (await screen.findByRole('heading', { level: 2, name: 'Connection' })).closest('section');
    if (!connectionSection) throw new Error('Connection section not found');

    const workspaceName = within(connectionSection).getByText('Mastra');
    expect(screen.queryByText('Mastra (T06CB4A5FT9)')).not.toBeInTheDocument();
    await user.hover(workspaceName);
    expect(await screen.findByText('Workspace ID: T06CB4A5FT9')).toBeInTheDocument();

    const accountName = within(connectionSection).getByText('Caleb Barnes');
    expect(screen.queryByText('Caleb Barnes (U095PUH0FKL)')).not.toBeInTheDocument();
    await user.hover(accountName);
    expect(await screen.findByText('Slack user ID: U095PUH0FKL')).toBeInTheDocument();

    expect(within(connectionSection).queryByText('Connected account')).not.toBeInTheDocument();
    expect(within(connectionSection).getByText(/Connected July 29, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Start and continue Factory sessions from Slack.')).toBeInTheDocument();

    const sessionBehaviorSection = screen
      .getByRole('heading', { level: 2, name: 'Session behavior' })
      .closest('section');
    if (!sessionBehaviorSection) throw new Error('Session behavior section not found');
    expect(
      within(sessionBehaviorSection).getByRole('combobox', { name: 'Default factory for Caleb Barnes' }),
    ).toHaveTextContent('OM Game');
    expect(
      within(sessionBehaviorSection).getByRole('switch', { name: 'Create work items for new Slack threads' }),
    ).toBeInTheDocument();

    const dangerZoneSection = screen.getByRole('heading', { level: 2, name: 'Danger zone' }).closest('section');
    if (!dangerZoneSection) throw new Error('Danger zone section not found');
    expect(dangerZoneSection).toHaveTextContent(
      'Slack messages from Caleb Barnes will no longer start or continue Factory sessions.',
    );
    expect(within(dangerZoneSection).getByText('Caleb Barnes').closest('strong')).not.toBeNull();

    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
      'Connection',
      'Session behavior',
      'Danger zone',
    ]);
  });

  it('given multiple linked accounts, when rendered, then it keeps every account configurable', async () => {
    mockAccounts([
      slackLink,
      {
        ...slackLink,
        externalTeamId: 'T02SECOND',
        externalUserId: 'U02SECOND',
        externalTeamName: 'Second workspace',
        externalUserName: 'Second user',
        defaultFactoryProjectId: 'fp-2',
      },
    ]);

    renderPage();

    expect(await screen.findByRole('combobox', { name: 'Default factory for Caleb Barnes' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default factory for Second user' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect Caleb Barnes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect Second user' })).toBeInTheDocument();
  });

  it('given no linked account, when rendered, then it offers Slack authentication', async () => {
    mockAccounts([]);

    renderPage();

    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    const slackRow = screen.getByRole('button', { name: /Slack.*Not connected.*Connect Slack/ });
    expect(slackRow).toBeEnabled();
    expect(slackRow).toHaveTextContent(/Slack.*Not connected.*Connect Slack/);
  });

  it('given a linked account, when work-item creation is enabled, then it updates the active Factory', async () => {
    mockAccounts([slackLink]);
    let patchBody: unknown;
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-1`, async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({ project: { id: 'fp-1', name: 'OM Game', slackWorkItemsEnabled: true } });
      }),
    );
    const { client } = renderPage();
    const user = userEvent.setup();
    const workItemSwitch = await screen.findByRole('switch', { name: 'Create work items for new Slack threads' });
    expect(workItemSwitch).not.toBeChecked();

    await user.click(workItemSwitch);

    await waitFor(() => expect(patchBody).toEqual({ slackWorkItemsEnabled: true }));
    await waitFor(() => expect(client.isMutating()).toBe(0));
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

    await user.click(await screen.findByRole('button', { name: 'Disconnect Caleb Barnes' }));

    await waitFor(() =>
      expect(deleteBody).toEqual({
        platform: 'slack',
        externalTeamId: 'T06CB4A5FT9',
        externalUserId: 'U095PUH0FKL',
      }),
    );
    expect(await screen.findByRole('button', { name: /Slack.*Not connected.*Connect Slack/ })).toBeEnabled();
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

    await user.click(await screen.findByRole('combobox', { name: 'Default factory for Caleb Barnes' }));
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
