// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentLayout } from '../../agent-layout';
import { emptyPlatforms, slackPlatform, systemPackages } from './fixtures/channels';
import { v2Agent } from './fixtures/composer-model-settings';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
  };
});

const BASE_URL = 'http://localhost:4111';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const navigateSpy = vi.fn();

const noopPaths = {
  agentLink: () => '',
  agentMessageLink: () => '',
  workflowLink: () => '',
  toolLink: () => '',
  scoreLink: () => '',
  scorerLink: () => '',
  toolByAgentLink: () => '',
  toolByWorkflowLink: () => '',
  promptLink: () => '',
  legacyWorkflowLink: () => '',
  policyLink: () => '',
  vNextNetworkLink: () => '',
  agentBuilderLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={navigateSpy} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/agents/agent-1/chat/new']}>
              <Routes>
                <Route
                  path="/agents/:agentId/*"
                  element={
                    <AgentLayout>
                      <div data-testid="agent-child" />
                    </AgentLayout>
                  }
                />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function commonHandlers() {
  return [
    http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackages)),
  ];
}

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('AgentLayout channels tab', () => {
  it('shows the Channels tab when channel platforms exist', async () => {
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackPlatform)),
    );

    renderLayout();

    expect(await screen.findByText('Channels')).not.toBeNull();
  });

  it('hides the Channels tab when no channel platforms exist', async () => {
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(emptyPlatforms)),
    );

    renderLayout();

    // Chat tab always renders; wait for it to confirm the layout mounted.
    expect(await screen.findByText('Chat')).not.toBeNull();
    await waitFor(() => expect(screen.queryByText('Channels')).toBeNull());
  });

  it('navigates to the channels route when the Channels tab is clicked', async () => {
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/channels/platforms`, () => HttpResponse.json(slackPlatform)),
    );

    renderLayout();

    const channelsTab = await screen.findByText('Channels');
    fireEvent.click(channelsTab);

    expect(navigateSpy).toHaveBeenCalledWith('/agents/agent-1/channels');
  });
});
