import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { ConnectedChannelAccount } from '../../domains/settings/services/channelAccounts';
import { OverlaysProvider } from '../../lib/overlays';
import { SlackConnectionPage } from '../SlackConnectionPage';

const slackLink: ConnectedChannelAccount = {
  platform: 'slack',
  externalTeamId: 'T00000001',
  externalUserId: 'U00000001',
  externalTeamName: 'Example Workspace',
  externalUserName: 'Test User',
  defaultFactoryProjectId: 'fp-1',
  linkedAt: '2026-01-15T12:00:00.000Z',
};

function mockAccounts(accounts: ConnectedChannelAccount[], canConnect = true) {
  server.use(http.get(`${TEST_BASE_URL}/web/channel-accounts`, () => HttpResponse.json({ accounts, canConnect })));
}

function mockFactories(slackWorkItemsEnabled = false) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: 'fp-1', name: 'Primary Factory', slackWorkItemsEnabled },
          { id: 'fp-2', name: 'Secondary Factory', slackWorkItemsEnabled: false },
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
        <OverlaysProvider>
          <Routes>
            <Route path="/factories/:factoryId/settings/connections/slack" element={<SlackConnectionPage />} />
          </Routes>
        </OverlaysProvider>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('SlackConnectionPage', () => {
  it('given an old server with no channel route, when rendered, then it shows the not-configured card instead of a parse error', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.html('<!doctype html><html><body>app shell</body></html>'),
      ),
    );

    renderPage();

    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText(/Slack is not set up for this factory/)).toBeInTheDocument();
    expect(screen.queryByText(/is not valid JSON/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Slack/ })).not.toBeInTheDocument();
  });

  it('given the server reports the Slack integration is not registered, when rendered, then it states the fact without naming env vars', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.json({ accounts: [], canConnect: false, reason: 'not_registered' }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText(/Slack is not set up for this factory/)).toBeInTheDocument();
    expect(screen.queryByText(/SLACK_APP_SIGNING_SECRET/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Slack/ })).not.toBeInTheDocument();
  });

  it('given a linked account, when rendered, then it identifies the workspace, user, link date, and default factory', async () => {
    mockAccounts([slackLink]);

    renderPage();
    const user = userEvent.setup();

    const connectionSection = (await screen.findByRole('heading', { level: 2, name: 'Connection' })).closest('section');
    if (!connectionSection) throw new Error('Connection section not found');

    const workspaceName = within(connectionSection).getByText('Example Workspace');
    expect(screen.queryByText('Example Workspace (T00000001)')).not.toBeInTheDocument();
    await user.hover(workspaceName);
    expect(await screen.findByText('Workspace ID: T00000001')).toBeInTheDocument();

    const accountName = within(connectionSection).getByText('Test User');
    expect(screen.queryByText('Test User (U00000001)')).not.toBeInTheDocument();
    await user.hover(accountName);
    expect(await screen.findByText('Slack user ID: U00000001')).toBeInTheDocument();

    expect(within(connectionSection).queryByText('Connected account')).not.toBeInTheDocument();
    expect(within(connectionSection).getByText(/Connected January 15, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Start and continue Factory sessions from Slack.')).toBeInTheDocument();

    const sessionBehaviorSection = screen
      .getByRole('heading', { level: 2, name: 'Session behavior' })
      .closest('section');
    if (!sessionBehaviorSection) throw new Error('Session behavior section not found');
    expect(
      within(sessionBehaviorSection).getByRole('combobox', { name: 'Default factory for Test User' }),
    ).toHaveTextContent('Primary Factory');
    expect(
      within(sessionBehaviorSection).getByRole('switch', { name: 'Create work items for new Slack threads' }),
    ).toBeInTheDocument();

    const dangerZoneSection = screen.getByRole('heading', { level: 2, name: 'Danger zone' }).closest('section');
    if (!dangerZoneSection) throw new Error('Danger zone section not found');
    expect(dangerZoneSection).toHaveTextContent(
      'Slack messages from Test User will no longer start or continue Factory sessions.',
    );
    expect(within(dangerZoneSection).getByText('Test User').closest('strong')).not.toBeNull();

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
        externalTeamId: 'T00000002',
        externalUserId: 'U00000002',
        externalTeamName: 'Example Workspace 2',
        externalUserName: 'Test User 2',
        defaultFactoryProjectId: 'fp-2',
      },
    ]);

    renderPage();

    expect(await screen.findByRole('combobox', { name: 'Default factory for Test User' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Default factory for Test User 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect Test User' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect Test User 2' })).toBeInTheDocument();
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
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Primary Factory', slackWorkItemsEnabled: true } });
      }),
    );
    const { client } = renderPage();
    const user = userEvent.setup();
    const workItemSwitch = await screen.findByRole('switch', { name: 'Create work items for new Slack threads' });
    expect(workItemSwitch).not.toBeChecked();

    await user.click(workItemSwitch);

    await waitFor(() => expect(patchBody).toEqual({ slackWorkItemsEnabled: true }));
    await waitForMutationsIdle(client);
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

    await user.click(await screen.findByRole('button', { name: 'Disconnect Test User' }));

    await waitFor(() =>
      expect(deleteBody).toEqual({
        platform: 'slack',
        externalTeamId: 'T00000001',
        externalUserId: 'U00000001',
      }),
    );
    expect(await screen.findByRole('button', { name: /Slack.*Not connected.*Connect Slack/ })).toBeEnabled();
  });

  it('given a disconnect that fails, when retried, then the account stays configurable', async () => {
    mockAccounts([slackLink]);
    server.use(
      http.delete(`${TEST_BASE_URL}/web/channel-accounts`, () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Disconnect Test User' }));

    expect(await screen.findByRole('button', { name: 'Disconnect Test User' })).toBeInTheDocument();
    expect(screen.getByText('Example Workspace')).toBeInTheDocument();
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

    await user.click(await screen.findByRole('combobox', { name: 'Default factory for Test User' }));
    await user.click(await screen.findByRole('option', { name: 'Secondary Factory' }));

    await waitFor(() =>
      expect(patchBody).toEqual({
        platform: 'slack',
        externalTeamId: 'T00000001',
        externalUserId: 'U00000001',
        factoryProjectId: 'fp-2',
      }),
    );
  });
});
