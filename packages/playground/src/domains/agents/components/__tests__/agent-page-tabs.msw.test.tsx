import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentLayout } from '../../agent-layout';
import { readOnlyAuthCapabilities, storedAgentReaderAuthCapabilities } from './fixtures/auth';
import { systemPackages } from './fixtures/channels';
import { v2Agent } from './fixtures/composer-model-settings';
import { LinkComponentProvider } from '@/lib/framework';
import { RouteHeaderActionsProvider, RouteHeaderActionsSlot } from '@/lib/route-header/route-header-actions';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';

const StubLink = ({
  children,
  to,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
  <a {...props} href={to ?? href}>
    {children}
  </a>
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
  cmsAgentEditLink: (agentId: string) => `/cms/agents/${agentId}/edit`,
} as never;

function renderLayout(initialEntry = '/agents/agent-1/threads/new') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={navigateSpy} paths={noopPaths}>
          <TooltipProvider>
            <RouteHeaderActionsProvider>
              <RouteHeaderActionsSlot />
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
            </RouteHeaderActionsProvider>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function commonHandlers(packagesResponse = systemPackages, authResponse = storedAgentReaderAuthCapabilities) {
  return [
    http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesResponse)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authResponse)),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
  ];
}

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('AgentLayout tool tabs', () => {
  describe('when CMS is available and stored-agent read access is allowed', () => {
    it('links the shared agent chrome to the full configuration screen', async () => {
      server.use(...commonHandlers(enabledPackages, storedAgentReaderAuthCapabilities));

      renderLayout('/agents/agent-1/editor');

      const fullConfiguration = await screen.findByRole('link', { name: 'Full configuration' });
      expect(fullConfiguration.getAttribute('href')).toBe('/cms/agents/agent-1/edit');
    });
  });

  describe('when CMS is available but stored-agent read access is denied', () => {
    it('does not expose the full configuration link', async () => {
      server.use(...commonHandlers(enabledPackages, readOnlyAuthCapabilities));

      renderLayout('/agents/agent-1/editor');

      expect(await screen.findByRole('tab', { name: /editor/i })).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole('link', { name: 'Full configuration' })).toBeNull());
    });
  });

  describe('when the editor is unavailable', () => {
    it('omits the Editor tab', async () => {
      server.use(...commonHandlers());
      renderLayout();
      await screen.findByRole('tab', { name: 'Chat' });
      expect(screen.queryByRole('tab', { name: 'Editor' })).toBeNull();
      const editor = screen.getByRole('button', { name: 'Editor' });
      expect(editor.textContent).toBe('');
      expect(editor.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('when the editor is configured', () => {
    it('renders the selected Editor after Chat, Traces, and Evals', async () => {
      server.use(...commonHandlers(enabledPackages));
      renderLayout('/agents/agent-1/editor');
      const editor = await screen.findByRole('tab', { name: 'Editor' });
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat', 'Traces', 'Evals', 'Editor']);
      expect(editor.getAttribute('aria-selected')).toBe('true');
      expect(screen.queryByRole('button', { name: 'Editor' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Evals' })).toBeNull();
    });
  });

  describe('when observability is unavailable', () => {
    it('offers Evals as an icon-only setup hint instead of a tab', async () => {
      server.use(...commonHandlers());
      renderLayout();
      const evals = await screen.findByRole('button', { name: 'Evals' });
      expect(evals.textContent).toBe('');
      expect(evals.getAttribute('aria-disabled')).toBe('true');
      expect(screen.queryByRole('tab', { name: 'Evals' })).toBeNull();
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

  it('keeps run options out of the top-level Evaluate tab bar', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/evaluate');

    await screen.findByRole('tab', { name: 'Editor' });
    expect(screen.queryByTestId('agent-top-bar-run-options-trigger')).toBeNull();
  });
});
