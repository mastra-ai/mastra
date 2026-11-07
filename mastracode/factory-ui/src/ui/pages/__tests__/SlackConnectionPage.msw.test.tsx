import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
import { Toaster } from '@mastra/playground-ui/components/Toaster';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { ConnectedChannelAccount } from '../../domains/settings/services/channelAccounts';
import type { SlackToolSettings, SlackToolSettingsPayload } from '../../domains/settings/services/slackToolSettings';
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

function mockFactories() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          { id: 'fp-1', name: 'Primary Factory', repositories: [] },
          { id: 'fp-2', name: 'Secondary Factory', repositories: [] },
        ],
      }),
    ),
  );
}

const defaultToolSettings: SlackToolSettings = {
  channels: 'session',
  channelIds: [],
  channelAccess: 'post',
  directMessages: 'none',
};

function mockToolSettings(payload: SlackToolSettingsPayload) {
  server.use(http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1/slack-tools`, () => HttpResponse.json(payload)));
}

function renderPage() {
  mockFactories();
  mockToolSettings({ settings: defaultToolSettings, channels: [], linked: false });
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/connections/slack']}>
      <SidebarProvider storageKey="slack-connection-page-test" mobileBreakpoint={0}>
        <OverlaysProvider>
          <Routes>
            <Route path="/factories/:factoryId/settings/connections/slack" element={<SlackConnectionPage />} />
          </Routes>
        </OverlaysProvider>
        <Toaster />
      </SidebarProvider>
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

    expect(await screen.findByText(/Slack is not set up for this factory/)).toBeInTheDocument();
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

    expect(await screen.findByText(/Slack is not set up for this factory/)).toBeInTheDocument();
    expect(screen.queryByText(/SLACK_APP_SIGNING_SECRET/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect Slack/ })).not.toBeInTheDocument();
  });

  it('given a linked account, when rendered, then it identifies the workspace, user, link date, and default factory', async () => {
    mockAccounts([slackLink]);

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Example Workspace');
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
    const linkedAt = new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(
      new Date(slackLink.linkedAt),
    );
    expect(within(connectionSection).getByText(`Connected ${linkedAt}`)).toBeInTheDocument();
    expect(screen.getByText('Start and continue Factory sessions from Slack.')).toBeInTheDocument();

    const sessionBehaviorSection = screen
      .getByRole('heading', { level: 2, name: 'Session behavior' })
      .closest('section');
    if (!sessionBehaviorSection) throw new Error('Session behavior section not found');
    expect(
      within(sessionBehaviorSection).getByRole('combobox', { name: 'Default factory for Test User' }),
    ).toHaveTextContent('Primary Factory');

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
      'What sessions can do in Slack',
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

  it('given a linked account, when rendered, then it offers no Slack work-item setting and never updates the Factory', async () => {
    mockAccounts([slackLink]);
    let projectPatches = 0;
    server.use(
      http.patch(`${TEST_BASE_URL}/web/factory/projects/:id`, () => {
        projectPatches += 1;
        return HttpResponse.json({ project: { id: 'fp-1', name: 'Primary Factory' } });
      }),
    );
    const { client } = renderPage();

    expect(await screen.findByRole('button', { name: 'Disconnect Test User' })).toBeInTheDocument();
    expect(screen.getByText('Example Workspace')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /create work items/i })).toBeNull();
    await waitForMutationsIdle(client);
    expect(projectPatches).toBe(0);
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

describe('SlackConnectionPage › what sessions can do in Slack', () => {
  const channels = [
    { id: 'C2', name: 'eng', isPrivate: false, appIsMember: true },
    { id: 'G3', name: 'finance', isPrivate: true, appIsMember: true },
    { id: 'C5', name: 'random', isPrivate: false, appIsMember: false },
  ];

  function section() {
    return screen.getByRole('heading', { level: 2, name: 'What sessions can do in Slack' }).closest('section')!;
  }

  function recordSaves() {
    const saves: unknown[] = [];
    server.use(
      http.put(`${TEST_BASE_URL}/web/factory/projects/fp-1/slack-tools`, async ({ request }) => {
        const settings = await request.json();
        saves.push(settings);
        return HttpResponse.json({ settings });
      }),
    );
    return saves;
  }

  it("given the defaults, when rendered, then sessions use only their own channel and DM no one", async () => {
    mockAccounts([slackLink]);
    renderPage();

    expect(await screen.findByRole('combobox', { name: 'Channels' })).toHaveTextContent("Only the session's own channel");
    expect(within(section()).getByRole('combobox', { name: 'Other channels' })).toBeDisabled();
    expect(within(section()).getByRole('combobox', { name: 'Direct messages' })).toHaveTextContent('No one');
    expect(within(section()).queryByRole('combobox', { name: 'Add a channel' })).toBeNull();
  });

  it('given every channel granted, then other channels can be set to read or post', async () => {
    mockAccounts([slackLink]);
    renderPage();
    mockToolSettings({ settings: { ...defaultToolSettings, channels: 'all' }, channels: [], linked: true });

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Channels' })).toHaveTextContent('Every channel the app is in'),
    );
    expect(screen.getByRole('combobox', { name: 'Other channels' })).toHaveTextContent('Read and post');
    expect(screen.getByRole('combobox', { name: 'Other channels' })).toBeEnabled();
  });

  it('given Slack is not set up, when rendered, then there is nothing to configure', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.json({ accounts: [], canConnect: false, reason: 'not_registered' }),
      ),
    );
    renderPage();

    expect(await screen.findByText(/Slack is not set up for this factory/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'What sessions can do in Slack' })).toBeNull();
  });

  it('when DMs are limited to connected people, then that choice is saved for the Factory', async () => {
    mockAccounts([slackLink]);
    const saves = recordSaves();
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Direct messages' }));
    await user.click(await screen.findByRole('option', { name: 'People connected to this Factory' }));

    await waitFor(() => expect(saves).toEqual([{ ...defaultToolSettings, directMessages: 'linked' }]));
    expect(screen.getByRole('combobox', { name: 'Direct messages' })).toHaveTextContent(
      'People connected to this Factory',
    );
  });

  async function addChannel(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(await screen.findByRole('combobox', { name: 'Add a channel' }));
    await user.keyboard(name);
    await user.click(await screen.findByRole('option', { name: new RegExp(`^#${name}`) }));
  }

  it('given chosen channels, when a channel the app is in is added from the search, then it is saved without joining', async () => {
    mockAccounts([slackLink]);
    renderPage();
    mockToolSettings({ settings: { ...defaultToolSettings, channels: 'selected' }, channels, linked: true });
    let joins = 0;
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/slack-tools/channels/:channelId/join`, () => {
        joins += 1;
        return HttpResponse.json({ joined: true });
      }),
    );
    const saves = recordSaves();
    const user = userEvent.setup();

    await addChannel(user, 'eng');

    await waitFor(() => expect(saves).toEqual([{ ...defaultToolSettings, channels: 'selected', channelIds: ['C2'] }]));
    expect(joins).toBe(0);
    const list = await screen.findByRole('list', { name: 'Channels sessions can use' });
    expect(within(list).getByText('#eng')).toBeInTheDocument();
  });

  it('given chosen channels, when one is removed, then the rest are saved and it can be added again', async () => {
    mockAccounts([slackLink]);
    renderPage();
    mockToolSettings({
      settings: { ...defaultToolSettings, channels: 'selected', channelIds: ['C2', 'G3'] },
      channels,
      linked: true,
    });
    const saves = recordSaves();
    const user = userEvent.setup();

    const list = await screen.findByRole('list', { name: 'Channels sessions can use' });
    expect(within(list).getByText('#finance').closest('li')).toHaveTextContent('Private');
    await user.click(within(list).getByRole('button', { name: 'Remove #eng' }));

    await waitFor(() => expect(saves).toEqual([{ ...defaultToolSettings, channels: 'selected', channelIds: ['G3'] }]));
    await waitFor(() => expect(within(list).queryByText('#eng')).toBeNull());
    await user.click(screen.getByRole('combobox', { name: 'Add a channel' }));
    expect(await screen.findByRole('option', { name: /^#eng/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^#finance/ })).toBeNull();
  });

  it('when a public channel the app is not in is added, then the app joins it before the choice is saved', async () => {
    mockAccounts([slackLink]);
    renderPage();
    mockToolSettings({ settings: { ...defaultToolSettings, channels: 'selected' }, channels, linked: true });
    const order: string[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/slack-tools/channels/:channelId/join`, ({ params }) => {
        order.push(`join ${params.channelId}`);
        return HttpResponse.json({ joined: true });
      }),
      http.put(`${TEST_BASE_URL}/web/factory/projects/fp-1/slack-tools`, async ({ request }) => {
        const settings = (await request.json()) as SlackToolSettings;
        order.push(`save ${settings.channelIds.join(',')}`);
        return HttpResponse.json({ settings });
      }),
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Add a channel' }));
    expect(await screen.findByRole('option', { name: /^#random/ })).toHaveTextContent('The app will join this channel');
    await user.click(screen.getByRole('option', { name: /^#random/ }));

    await waitFor(() => expect(order).toEqual(['join C5', 'save C5']));
    expect(
      within(await screen.findByRole('list', { name: 'Channels sessions can use' })).getByText('#random'),
    ).toBeInTheDocument();
  });

  it("when the app can't join, then it says why and nothing is saved", async () => {
    mockAccounts([slackLink]);
    renderPage();
    mockToolSettings({ settings: { ...defaultToolSettings, channels: 'selected' }, channels, linked: true });
    server.use(
      http.post(`${TEST_BASE_URL}/web/factory/projects/fp-1/slack-tools/channels/:channelId/join`, () =>
        HttpResponse.json(
          {
            error: 'missing_scope',
            message: 'The Slack app needs the channels:join permission. Reinstall the app to add it.',
          },
          { status: 409 },
        ),
      ),
    );
    const saves = recordSaves();
    const user = userEvent.setup();

    await addChannel(user, 'random');

    expect(await screen.findByText(/needs the channels:join permission/)).toBeInTheDocument();
    expect(saves).toEqual([]);
    expect(screen.queryByRole('list', { name: 'Channels sessions can use' })).toBeNull();
  });

  it('given chosen channels but no connected Slack account, then it asks you to connect to pick channels', async () => {
    mockAccounts([]);
    renderPage();
    mockToolSettings({ settings: { ...defaultToolSettings, channels: 'selected' }, channels: [], linked: false });

    expect(await screen.findByText(/Connect your Slack account above to pick/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Add a channel' })).toBeNull();
  });
});
