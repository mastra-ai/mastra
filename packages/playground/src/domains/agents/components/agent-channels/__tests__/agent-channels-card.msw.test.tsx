// @vitest-environment jsdom
import type { ChannelInstallationInfo } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import {
  activeDiscordInstallations,
  noSlackInstallations,
  pendingSlackInstallations,
  slackDiscordConfiguredPlatforms,
  slackInstallations,
  unconfiguredPlatforms,
} from '../../__tests__/fixtures/channels';
import { AgentChannelsCard } from '../agent-channels-card';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const HEADING = 'Finish connecting your channels';
const EMPTY_HEADING = 'Connect your channels';

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter>
            <AgentChannelsCard agentId="agent-1" />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { ...view, queryClient };
}

const useChannels = (slackInstalls: ChannelInstallationInfo[], discordInstalls: ChannelInstallationInfo[]) =>
  server.use(
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackDiscordConfiguredPlatforms)),
    http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstalls)),
    http.get(`${BASE_URL}/api/channels/discord/installations`, () => HttpResponse.json(discordInstalls)),
  );

const settle = async (queryClient: QueryClient) => {
  for (const platform of ['slack', 'discord']) {
    await waitFor(() =>
      expect(queryClient.getQueryState(['channels', 'installations', platform, 'agent-1'])?.status).toBe('success'),
    );
  }
  await act(async () => {});
};

afterEach(() => cleanup());

describe('AgentChannelsCard', () => {
  it('offers Connect for configured channels left to connect once another is installed', async () => {
    useChannels(slackInstallations, noSlackInstallations);

    renderCard();

    expect(await screen.findByText(HEADING)).not.toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Discord')).not.toBeNull();
    expect(screen.queryByText('Slack')).toBeNull();
    expect(screen.queryByText('Telegram')).toBeNull();
  });

  it('starts the connect flow for the clicked channel', async () => {
    useChannels(noSlackInstallations, activeDiscordInstallations);
    let connectBody: unknown;
    server.use(
      http.post(`${BASE_URL}/api/channels/slack/connect`, async ({ request }) => {
        connectBody = await request.json();
        return HttpResponse.json({ type: 'immediate', installationId: 'install-1' });
      }),
    );

    renderCard();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));

    await waitFor(() => expect(connectBody).toMatchObject({ agentId: 'agent-1' }));
  });

  it('flags a pending install and reconciles it when the window regains focus', async () => {
    useChannels(pendingSlackInstallations, activeDiscordInstallations);
    let reconciled = false;
    server.use(
      http.post(`${BASE_URL}/api/channels/slack/agent-1/reconcile`, () => {
        reconciled = true;
        return HttpResponse.json(null);
      }),
    );

    renderCard();

    expect(await screen.findByText('Pending')).not.toBeNull();
    fireEvent.focus(window);
    await waitFor(() => expect(reconciled).toBe(true));
  });

  it('offers Connect for every configured channel when nothing is connected yet', async () => {
    useChannels(noSlackInstallations, noSlackInstallations);

    renderCard();

    expect(await screen.findByText(EMPTY_HEADING)).not.toBeNull();
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Connect' })).toHaveLength(2);
    expect(screen.getByText('Slack')).not.toBeNull();
    expect(screen.getByText('Discord')).not.toBeNull();
    expect(screen.queryByText('Telegram')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('renders nothing when no channel platform is configured', async () => {
    let platformsRequested = false;
    server.use(
      http.get(`${BASE_URL}/api/channels/platforms`, () => {
        platformsRequested = true;
        return HttpResponse.json(unconfiguredPlatforms);
      }),
    );

    renderCard();
    await waitFor(() => expect(platformsRequested).toBe(true));
    await act(async () => {});

    expect(screen.queryByText(EMPTY_HEADING)).toBeNull();
    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing once every configured channel is installed', async () => {
    useChannels(slackInstallations, activeDiscordInstallations);

    const { queryClient } = renderCard();
    await settle(queryClient);

    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
