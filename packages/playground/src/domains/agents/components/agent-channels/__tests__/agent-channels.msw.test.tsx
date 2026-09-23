import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
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
          <MemoryRouter initialEntries={['/agents/agent-1/overview?tab=channels']}>
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
    expect((await screen.findByText('Connected')).querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders the empty state when no platforms are configured', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    );

    renderChannels();

    expect(await screen.findByText('No channel platforms configured.')).not.toBeNull();
  });

  it('renders every configured platform with its status', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackAndDiscordPlatforms)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstallations)),
      http.get(`${BASE_URL}/api/channels/discord/installations`, () => HttpResponse.json(noSlackInstallations)),
    );

    renderChannels();

    expect(await screen.findByText('Slack')).not.toBeNull();
    expect(await screen.findByText('Discord')).not.toBeNull();
    expect((await screen.findByText('Not configured')).querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
