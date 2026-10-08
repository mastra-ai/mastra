// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { noSlackInstallations, slackInstallations } from '../../__tests__/fixtures/channels';
import { AgentChannelsCard } from '../agent-channels-card';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const HEADING = 'Finish connecting your channels';

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

const useChannels = (slackInstalls: unknown[], discordInstalls: unknown[]) =>
  server.use(
    http.get(`${BASE_URL}/api/channels/platforms`, () =>
      HttpResponse.json([
        { id: 'slack', name: 'Slack', isConfigured: true },
        { id: 'discord', name: 'Discord', isConfigured: true },
        { id: 'telegram', name: 'Telegram', isConfigured: false },
      ]),
    ),
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

  it('flags a pending install', async () => {
    useChannels([{ ...slackInstallations[0], status: 'pending' }], noSlackInstallations);

    renderCard();

    expect(await screen.findByText('Pending')).not.toBeNull();
    expect(screen.getByText(HEADING)).not.toBeNull();
  });

  it('renders nothing when no channel is connected yet', async () => {
    useChannels(noSlackInstallations, noSlackInstallations);

    const { queryClient } = renderCard();
    await settle(queryClient);

    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders nothing once every configured channel is installed', async () => {
    useChannels(slackInstallations, [{ ...slackInstallations[0], platform: 'discord' }]);

    const { queryClient } = renderCard();
    await settle(queryClient);

    expect(screen.queryByText(HEADING)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
