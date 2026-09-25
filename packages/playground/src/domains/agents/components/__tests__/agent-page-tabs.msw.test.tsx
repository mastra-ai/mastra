import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentLayout } from '../../agent-layout';
import { systemPackages } from './fixtures/channels';
import { agentsResponse, v2Agent } from './fixtures/composer-model-settings';
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
    http.get(`${BASE_URL}/api/agents`, () => HttpResponse.json(agentsResponse)),
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
    it('replaces the Editor tab with a disabled icon button', async () => {
      server.use(...commonHandlers());
      const { queryClient } = renderLayout();

      await waitFor(() => expect(queryClient.getQueryState(['mastra-packages'])?.status).toBe('success'));
      const editor = screen.getByRole('button', { name: 'Editor' });
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat']);
      expect(editor.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(editor);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('explains how to enable the Editor when focused', async () => {
      server.use(...commonHandlers());
      renderLayout();
      const editor = await screen.findByRole('button', { name: 'Editor' });
      fireEvent.focus(editor);

      const tooltip = await screen.findByRole('tooltip');
      expect(within(tooltip).queryByText('Editor')).toBeNull();
      expect(tooltip.textContent).toContain('Add @mastra/editor');
    });

    it('links to the Editor documentation from the tooltip', async () => {
      server.use(...commonHandlers());
      renderLayout();
      const editor = await screen.findByRole('button', { name: 'Editor' });
      fireEvent.focus(editor);

      const docsLink = within(await screen.findByRole('tooltip')).getByRole('link', { name: 'Learn more' });
      expect(docsLink.getAttribute('href')).toBe('https://mastra.ai/docs/editor/overview');
      expect(docsLink.getAttribute('target')).toBe('_blank');
      expect(docsLink.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('when the editor is configured but observability is not', () => {
    it('shows Editor as a tab and Traces as a disabled button', async () => {
      server.use(...commonHandlers({ ...enabledPackages, observabilityEnabled: false }));
      const { queryClient } = renderLayout();

      await waitFor(() => expect(queryClient.getQueryState(['mastra-packages'])?.status).toBe('success'));
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Chat', 'Editor']);
      expect(screen.getByRole('button', { name: 'Traces' }).getAttribute('aria-disabled')).toBe('true');
    });

    it('links to the observability documentation from the Traces tooltip', async () => {
      server.use(...commonHandlers({ ...enabledPackages, observabilityEnabled: false }));
      renderLayout();
      const traces = await screen.findByRole('button', { name: 'Traces' });
      fireEvent.focus(traces);

      const docsLink = within(await screen.findByRole('tooltip')).getByRole('link', { name: 'Learn more' });
      expect(docsLink.getAttribute('href')).toBe('https://mastra.ai/docs/observability/overview');
      expect(docsLink.getAttribute('target')).toBe('_blank');
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

      await screen.findByRole('tab', { name: 'Editor' });
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

    expect(await screen.findByRole('button', { name: 'Traces' })).not.toBeNull();
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
    expect(screen.getByRole('button', { name: 'Traces' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps run options out of the Editor tab bar because the editor chat composer owns them', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/editor');

    expect(await screen.findByRole('tab', { name: 'Editor' })).not.toBeNull();
    expect(screen.queryByTestId('agent-top-bar-run-options-trigger')).toBeNull();
    expect(screen.queryByTestId('agent-tracing-controls-trigger')).toBeNull();
  });
});
