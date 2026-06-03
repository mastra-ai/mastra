// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentChannelsPage from '../index';
import {
  emptyPlatforms,
  noSlackInstallations,
  slackAndDiscordPlatforms,
  slackInstallations,
  slackPlatform,
} from '@/domains/agents/components/__tests__/fixtures/channels';
import { v2Agent } from '@/domains/agents/components/__tests__/fixtures/composer-model-settings';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
  };
});

const BASE_URL = 'http://localhost:4111';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={['/agents/agent-1/channels']}>
            <Routes>
              <Route path="/agents/:agentId/channels" element={<AgentChannelsPage />} />
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => cleanup());

describe('AgentChannelsPage MSW integration', () => {
  it('renders a connected platform when installations are active', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackPlatform)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstallations)),
    );

    renderPage();

    expect(await screen.findByText('Slack')).not.toBeNull();
    expect(await screen.findByText('Connected')).not.toBeNull();
  });

  it('renders the empty state when no platforms are configured', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    );

    renderPage();

    expect(await screen.findByText('No channel platforms configured.')).not.toBeNull();
  });

  it('shows a loading state while the agent is being fetched', async () => {
    const gate = (() => {
      let resolve: () => void = () => {};
      const promise = new Promise<void>(r => {
        resolve = r;
      });
      return { promise, resolve };
    })();

    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, async () => {
        await gate.promise;
        return HttpResponse.json(v2Agent);
      }),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    );

    renderPage();

    expect(await screen.findByRole('status', { name: 'Loading' })).not.toBeNull();

    gate.resolve();

    await waitFor(() => expect(screen.queryByText('No channel platforms configured.')).not.toBeNull());
  });

  it('filters platform rows by the search input', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackAndDiscordPlatforms)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json(slackInstallations)),
      http.get(`${BASE_URL}/api/channels/discord/installations`, () => HttpResponse.json(noSlackInstallations)),
    );

    renderPage();

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

    renderPage();

    expect(await screen.findByText('Slack')).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Filter by platform name'), { target: { value: 'nonexistent' } });

    await waitFor(() => expect(screen.queryByText('No channels match your search')).not.toBeNull());
    expect(screen.queryByText('Slack')).toBeNull();
    expect(screen.queryByText('Discord')).toBeNull();
  });
});
