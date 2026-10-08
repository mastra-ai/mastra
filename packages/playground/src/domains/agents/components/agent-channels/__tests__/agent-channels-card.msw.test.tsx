// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { emptyPlatforms, noSlackInstallations, slackPlatform } from '../../__tests__/fixtures/channels';
import { AgentChannelsCard } from '../agent-channels-card';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
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
}

afterEach(() => cleanup());

describe('AgentChannelsCard', () => {
  it('offers Connect for a configured platform', async () => {
    server.use(
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackPlatform)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(noSlackInstallations)),
    );

    renderCard();

    expect(await screen.findByRole('button', { name: 'Connect' })).not.toBeNull();
  });

  it('renders nothing when no platforms are configured', async () => {
    server.use(http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)));

    renderCard();

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByTestId('agent-channels-card')).toBeNull();
  });
});
