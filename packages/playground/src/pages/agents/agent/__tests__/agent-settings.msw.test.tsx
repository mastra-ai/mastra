import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

const renderSettingsRoute = (initialEntry = `/agents/${AGENT_ID}/settings`) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <TooltipProvider>
            <Routes>
              <Route path="/agents/:agentId/settings" element={<Agent view="settings" />} />
              <Route path="/agents/:agentId/chat/:threadId" element={<div data-testid="chat-route" />} />
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
    expect(screen.getByTestId('agent-route-sidebar-skeleton')).not.toBeNull();
    expect(screen.getByTestId('agent-settings-skeleton')).not.toBeNull();
  });

  it('renders the full-zone settings view with the agent overview by default', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(await screen.findByTestId('agent-settings-view')).not.toBeNull();
    // Overview content = AgentMetadata sections. Generous timeout: parallel
    // suite runs make the first metadata render slow under worker load.
    expect(await screen.findByRole('heading', { name: 'Tools' }, { timeout: 10_000 })).not.toBeNull();
    // The chat is replaced, not rendered alongside
    expect(screen.queryByTestId('thread-wrapper')).toBeNull();
  });

  it('shows the static memory configuration under the memory tab', async () => {
    useDefaultHandlers();
    renderSettingsRoute(`/agents/${AGENT_ID}/settings?tab=memory`);

    expect(await screen.findByTestId('agent-settings-view')).not.toBeNull();
    // 'General' appears both as the first settings tab and as a memory config
    // section title, so assert on the collection rather than a unique match.
    expect((await screen.findAllByText('General')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Semantic Recall')).not.toBeNull();
  });

  it('shows a Channels tab in settings when channel platforms exist', async () => {
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
    renderSettingsRoute(`/agents/${AGENT_ID}/settings?tab=channels`);

    expect(await screen.findByRole('tab', { name: 'Channels' })).not.toBeNull();
    expect(await screen.findByText('Slack')).not.toBeNull();
  });

  it('hides the Channels tab in settings when no channel platforms exist', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    expect(await screen.findByRole('tab', { name: 'General' })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Channels' })).toBeNull();
  });

  it('closes back to the chat from the view header toggle', async () => {
    useDefaultHandlers();
    renderSettingsRoute();

    const toggle = await screen.findByTestId('agent-view-header-toggle');
    expect(toggle.textContent).toMatch(/close/i);

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(await screen.findByTestId('chat-route')).not.toBeNull();
  });
});
