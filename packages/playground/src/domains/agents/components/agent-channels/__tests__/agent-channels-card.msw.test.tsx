// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { noSlackInstallations, slackAndDiscordPlatforms, slackInstallations } from '../../__tests__/fixtures/channels';
import { AgentChannelsCard } from '../agent-channels-card';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

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

const useChannels = (slackInstalls: unknown[]) =>
  server.use(
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackAndDiscordPlatforms)),
    http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstalls)),
    http.get(`${BASE_URL}/api/channels/discord/installations`, () => HttpResponse.json(noSlackInstallations)),
  );

afterEach(() => cleanup());

describe('AgentChannelsCard', () => {
  it('offers Connect only for configured platforms the agent is not installed in', async () => {
    useChannels(noSlackInstallations);

    renderCard();

    expect(await screen.findByRole('button', { name: 'Connect' })).not.toBeNull();
    expect(screen.getByText('Choose how to talk to your agent')).not.toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText('Discord')).toBeNull();
  });

  it('flags a pending install', async () => {
    useChannels([{ ...slackInstallations[0], status: 'pending' }]);

    renderCard();

    expect(await screen.findByText('Pending')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Connect' })).not.toBeNull();
  });

  it('renders nothing once every configured platform is installed', async () => {
    useChannels(slackInstallations);

    const { queryClient } = renderCard();

    await waitFor(() =>
      expect(queryClient.getQueryState(['channels', 'installations', 'slack', 'agent-1'])?.status).toBe('success'),
    );
    await act(async () => {});
    expect(screen.queryByTestId('agent-channels-card')).toBeNull();
    expect(screen.queryByText('Choose how to talk to your agent')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
