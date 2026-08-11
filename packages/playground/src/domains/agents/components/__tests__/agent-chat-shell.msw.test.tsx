import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentChatShell } from '../agent-chat-shell';
import { v2Agent } from './fixtures/composer-model-settings';
import { builderDisabled, observationalMemory, rbacDisabledAuth, threadMessages } from './fixtures/memory-panel';
import { MemoryTimelineProvider } from '@/domains/agents/context/memory-timeline-context';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const noopPaths = {
  cmsAgentEditLink: () => '',
} as never;

// Header data — same regardless of memory enablement.
const headerHandlers = () => [
  http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
  http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(rbacDisabledAuth)),
  http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderDisabled)),
];

function renderShell(onOM = vi.fn(), onMessages = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  server.use(
    ...headerHandlers(),
    http.get(`${BASE_URL}/api/memory/observational-memory`, () => {
      onOM();
      return HttpResponse.json(observationalMemory);
    }),
    http.get(`${BASE_URL}/api/memory/threads/thread-1/messages`, () => {
      onMessages();
      return HttpResponse.json(threadMessages);
    }),
  );

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={vi.fn()} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/agents/agent-1/chat/thread-1']}>
              <Routes>
                <Route
                  path="/agents/:agentId/chat/:threadId"
                  element={
                    <MemoryTimelineProvider>
                      <AgentChatShell
                        agentId="agent-1"
                        view="chat"
                        leftSlot={<div data-testid="left-slot" />}
                        leftDrawerLabel="Open threads and memory"
                        browserOverlay={null}
                      >
                        <div data-testid="agent-chat" />
                      </AgentChatShell>
                    </MemoryTimelineProvider>
                  }
                />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { onOM, onMessages };
}

afterEach(() => {
  cleanup();
  delete window.MASTRA_STUDIO_BASE_PATH;
});

describe('AgentChatShell', () => {
  describe('when the Studio uses a nested base path', () => {
    it('copies a shareable session URL within the base path', async () => {
      window.MASTRA_STUDIO_BASE_PATH = '/studio/v1';
      const writeText = vi.fn().mockResolvedValue(undefined);
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

      try {
        renderShell();
        const shareButton = await screen.findByTestId('agent-entity-header-share');
        await act(async () => {
          fireEvent.click(shareButton);
          await Promise.resolve();
        });

        await waitFor(() =>
          expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/studio/v1/agents/agent-1/session`),
        );
      } finally {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
      }
    });
  });

  it('renders the header without the (removed) memory launcher', async () => {
    renderShell();

    // Header renders (share button) but the OM panel launcher no longer lives here.
    expect(await screen.findByTestId('agent-entity-header-share')).not.toBeNull();
    expect(screen.queryByTestId('agent-view-header-open-memory')).toBeNull();
    expect(screen.queryByRole('button', { name: /memory/i })).toBeNull();
  });

  it('never owns or fetches the OM panel data from the shell', async () => {
    const { onOM, onMessages } = renderShell();

    await screen.findByTestId('agent-entity-header-share');

    // OM/messages fetching moved into the left memory card; the shell must not fire them.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    expect(onOM).not.toHaveBeenCalled();
    expect(onMessages).not.toHaveBeenCalled();
    expect(screen.queryByRole('checkbox', { name: 'Close memory panel' })).toBeNull();
  });

  it('renders its left slot and children', async () => {
    renderShell();

    expect(await screen.findByTestId('agent-entity-header-share')).not.toBeNull();
    expect(screen.getAllByTestId('left-slot')).toHaveLength(2);
    expect(screen.getByTestId('agent-chat')).not.toBeNull();
  });
});
