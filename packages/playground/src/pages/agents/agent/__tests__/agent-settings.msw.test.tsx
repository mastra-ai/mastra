import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { emptyPlatforms, slackPlatform } from '../../../../domains/agents/components/__tests__/fixtures/channels';
import {
  memoryDisabled,
  v2Agent,
} from '../../../../domains/agents/components/__tests__/fixtures/composer-model-settings';
import { semanticRecallConfig } from '../../../../domains/agents/components/memory-sidebar/__tests__/fixtures/memory';
import Agent from '../index';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const useDefaultHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
    http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
    http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
      HttpResponse.json({ workingMemory: null, source: 'thread' }),
    ),
    http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
  );
};

const renderSettingsRoute = (initialEntry = `/agents/${AGENT_ID}/overview`) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <TooltipProvider>
            <Routes>
              <Route path="/agents/:agentId/overview" element={<Agent />} />
              <Route path="/agents/:agentId/threads/:threadId" element={<div data-testid="chat-route" />} />
            </Routes>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('Agent settings view', () => {
  it('keeps the redesigned route shell visible while the agent record is loading', () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(screen.getByTestId('agent-route-skeleton')).not.toBeNull();
    // No thread sidebar on the overview page — the skeleton must not show one.
    expect(screen.queryByTestId('agent-route-sidebar-skeleton')).toBeNull();
    expect(screen.getByTestId('agent-settings-skeleton')).not.toBeNull();
  });

  it('renders the full-zone settings view with the agent overview by default', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(await screen.findByTestId('agent-settings-view')).not.toBeNull();
    // Overview content = AgentMetadata sections. Generous timeout: parallel
    // suite runs make the first metadata render slow under worker load.
    expect(await screen.findByRole('heading', { name: /^Tools/ }, { timeout: 10_000 })).not.toBeNull();
    // The chat is replaced, not rendered alongside
    expect(screen.queryByTestId('thread-wrapper')).toBeNull();
  });

  it('shows the static memory configuration inline on the overview page', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(await screen.findByTestId('agent-settings-view')).not.toBeNull();
    // Memory config is stacked below the metadata — no sub-tabs anymore.
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(await screen.findByText('Semantic Recall')).not.toBeNull();
  });

  it('shows the channels section inline when channel platforms exist', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(v2Agent)),
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json(semanticRecallConfig)),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
      http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
      http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
      http.get(`${BASE_URL}/api/scores/scorers`, () => HttpResponse.json({ scorers: [] })),
      http.get(`${BASE_URL}/api/memory/threads/:threadId/working-memory`, () =>
        HttpResponse.json({ workingMemory: null, source: 'thread' }),
      ),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackPlatform)),
      http.get(`${BASE_URL}/api/channels/slack/installations`, () => HttpResponse.json([])),
    );
    renderSettingsRoute();

    expect(await screen.findByText('Slack')).not.toBeNull();
  });

  it('hides the channels section when no channel platforms exist', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(await screen.findByTestId('agent-settings-view')).not.toBeNull();
    expect(screen.queryByText('Slack')).toBeNull();
  });

  it('shows no Close toggle and keeps the share button next to the agent name', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(await screen.findByTestId('agent-entity-header-share')).not.toBeNull();
    expect(screen.queryByTestId('agent-view-header-toggle')).toBeNull();
  });
});
