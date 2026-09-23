import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentLayout } from '../../agent-layout';
import { systemPackages } from './fixtures/channels';
import { v2Agent } from './fixtures/composer-model-settings';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const navigateSpy = vi.fn();
const enabledPackages = { ...systemPackages, cmsEnabled: true, observabilityEnabled: true };

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
  experimentLink: () => '',
  cmsAgentEditLink: () => '',
} as never;

function renderLayout(initialEntry = '/agents/agent-1/chat/new') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const view = render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={navigateSpy} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
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
  return { ...view, queryClient };
}

function commonHandlers(packagesResponse = systemPackages) {
  return [
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json({ 'agent-1': v2Agent })),
    http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesResponse)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
  ];
}

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('AgentLayout tool tabs', () => {
  describe('when the editor is unavailable', () => {
    it('keeps the Editor tab visible but disabled', async () => {
      server.use(...commonHandlers());
      const { queryClient } = renderLayout();
      const editor = await screen.findByRole('tab', { name: 'Editor' });

      await waitFor(() => expect(queryClient.getQueryState(['mastra-packages'])?.status).toBe('success'));
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat', 'Traces', 'Editor']);
      expect(editor.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(editor);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('explains how to enable the Editor when focused', async () => {
      server.use(...commonHandlers());
      renderLayout();
      const editor = await screen.findByRole('tab', { name: 'Editor' });
      if (editor.parentElement) fireEvent.focus(editor.parentElement);

      expect((await screen.findByRole('tooltip')).textContent).toContain('Add @mastra/editor');
    });
  });

  describe('when the editor is configured', () => {
    it('renders the selected Editor after Chat and Traces', async () => {
      server.use(...commonHandlers(enabledPackages));
      renderLayout('/agents/agent-1/editor');
      const editor = await screen.findByRole('tab', { name: 'Editor' });
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat', 'Traces', 'Editor']);
      expect(editor.getAttribute('aria-selected')).toBe('true');
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Editor' }).getAttribute('aria-disabled')).not.toBe('true'),
      );
    });

    it('navigates to the Editor', async () => {
      server.use(...commonHandlers(enabledPackages));
      renderLayout();

      const editor = await screen.findByRole('tab', { name: 'Editor' });
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Editor' }).getAttribute('aria-disabled')).not.toBe('true'),
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Editor' }));

      expect(navigateSpy).toHaveBeenCalledWith('/agents/agent-1/editor');
    });
  });

  describe('when the agent tabs render', () => {
    it('does not expose Review as a top-level tab', async () => {
      server.use(...commonHandlers(enabledPackages));
      renderLayout();
      await screen.findByRole('tab', { name: 'Chat' });
      expect(screen.queryByRole('tab', { name: 'Review' })).toBeNull();
    });
  });
  it('renders the tool tabs without a Channels tab (channels moved to settings)', async () => {
    const onPlatforms = vi.fn();
    server.use(
      ...commonHandlers(),
      http.get(`${BASE_URL}/api/channels/platforms`, () => {
        onPlatforms();
        return HttpResponse.json([]);
      }),
    );

    renderLayout();

    expect(await screen.findByText('Traces')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Chat' })).not.toBeNull();
    // Overview is now a side panel toggled from the header, not a tab.
    expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull();
    expect(screen.getByTestId('agent-overview-panel-toggle')).not.toBeNull();

    // Channels is configuration, not a tool: no tab and no platforms fetch from the tab bar.
    await waitFor(() => expect(screen.queryByText('Channels')).toBeNull());
    expect(onPlatforms).not.toHaveBeenCalled();
  });

  it('highlights the Chat tab on the thread routes', async () => {
    server.use(...commonHandlers());

    renderLayout('/agents/agent-1/threads/new');

    const chatTab = await screen.findByRole('tab', { name: 'Chat' });
    expect(chatTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Traces' }).getAttribute('aria-selected')).toBe('false');
  });

  it('keeps run options out of the Editor tab bar because the editor chat composer owns them', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/editor');

    expect(await screen.findByRole('tab', { name: 'Editor' })).not.toBeNull();
    expect(screen.queryByTestId('agent-top-bar-run-options-trigger')).toBeNull();
    expect(screen.queryByTestId('agent-tracing-controls-trigger')).toBeNull();
  });
});
