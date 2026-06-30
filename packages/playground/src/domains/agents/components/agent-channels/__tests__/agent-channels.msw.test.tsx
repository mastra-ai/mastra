import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  emptyPlatforms,
  noSlackInstallations,
  slackAndDiscordPlatforms,
  slackInstallations,
  slackPlatform,
} from '../../__tests__/fixtures/channels';
import { AgentChannels } from '../agent-channels';
import { v2Agent } from '@/domains/agents/components/__tests__/fixtures/composer-model-settings';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';

function renderChannels() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={['/agents/agent-1/settings?tab=channels']}>
            <AgentChannels agentId="agent-1" />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => cleanup());

describe('AgentChannels MSW integration', () => {
  it('renders a connected platform when installations are active', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackPlatform)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstallations)),
    );

    renderChannels();

    expect(await screen.findByText('Slack')).not.toBeNull();
    expect(await screen.findByText('Connected')).not.toBeNull();
  });

  it('renders the empty state when no platforms are configured', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    );

    renderChannels();

    expect(await screen.findByText('No channel platforms configured.')).not.toBeNull();
  });

  it('filters platform rows by the search input', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackAndDiscordPlatforms)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstallations)),
      http.get(`${BASE_URL}/api/channels/discord/installations`, () => HttpResponse.json(noSlackInstallations)),
    );

    renderChannels();

    expect(await screen.findByText('Slack')).not.toBeNull();
    expect(await screen.findByText('Discord')).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Filter by platform name'), { target: { value: 'slack' } });

    await waitFor(() => expect(screen.queryByText('Discord')).toBeNull());
    expect(screen.queryByText('Slack')).not.toBeNull();
  });

  it('shows a no-match message when the search matches nothing', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackAndDiscordPlatforms)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstallations)),
      http.get(`${BASE_URL}/api/channels/discord/installations`, () => HttpResponse.json(noSlackInstallations)),
    );

    renderChannels();

    expect(await screen.findByText('Slack')).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Filter by platform name'), { target: { value: 'nonexistent' } });

    await waitFor(() => expect(screen.queryByText('No channels match your search')).not.toBeNull());
    expect(screen.queryByText('Slack')).toBeNull();
    expect(screen.queryByText('Discord')).toBeNull();
  });
});
