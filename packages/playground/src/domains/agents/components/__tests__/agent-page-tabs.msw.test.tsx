import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentLayout } from '../../agent-layout';
import { systemPackages } from './fixtures/channels';
import { v2Agent } from './fixtures/composer-model-settings';
import { useThreadInput } from '@/domains/conversation';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

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
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function ThreadInputRouteProbe() {
  const navigate = useNavigate();
  const { threadInput, setThreadInput } = useThreadInput('thread-1');

  return (
    <div>
      <textarea
        aria-label="composer probe"
        value={threadInput}
        onChange={event => setThreadInput(event.currentTarget.value)}
      />
      <button type="button" onClick={() => void navigate('/agents/agent-1/versions/version-1/threads/thread-1')}>
        Switch version
      </button>
    </div>
  );
}

function renderLayout(
  initialEntry = '/agents/agent-1/threads/new',
  child: React.ReactNode = <div data-testid="agent-child" />,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={navigateSpy} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
              <Routes>
                <Route path="/agents/:agentId/*" element={<AgentLayout>{child}</AgentLayout>} />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function commonHandlers(packagesResponse = systemPackages) {
  return [
    http.get(`${BASE_URL}/api/agents/agent-1`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesResponse)),
  ];
}

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('AgentLayout tool tabs', () => {
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

    expect(await screen.findByText('Chat')).not.toBeNull();
    expect(screen.getByText('Traces')).not.toBeNull();

    // Channels is configuration, not a tool: no tab and no platforms fetch from the tab bar.
    await waitFor(() => expect(screen.queryByText('Channels')).toBeNull());
    expect(onPlatforms).not.toHaveBeenCalled();
  });

  it('lets the tab list keep the full row width on mobile by wrapping the right-slot controls', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/evaluate');

    // Below lg the right-slot buttons wrap onto their own line, right-aligned,
    // instead of stealing width from the (scrollable) tab list.
    const runOptionsTrigger = await screen.findByTestId('agent-top-bar-run-options-trigger');
    const rightSlot = runOptionsTrigger.parentElement!;
    expect(rightSlot.className).toContain('ml-auto');

    const tabsRow = rightSlot.parentElement!;
    expect(tabsRow.className).toContain('max-lg:flex-wrap');

    // flex-1 (basis 0) never wraps; on mobile the tabs need their content-sized
    // basis back (flex-auto) so the row can decide to wrap the right slot.
    const tabsRoot = screen.getByRole('tablist').parentElement!.parentElement!;
    expect(tabsRoot.className).toContain('min-w-0');
    expect(tabsRoot.className).toContain('max-lg:flex-auto');
  });

  it('keeps version routes in chat without restoring a separate Editor tab', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/versions/version-1/threads/thread-1');

    expect(await screen.findByRole('tab', { name: /chat/i })).not.toBeNull();
    expect(screen.queryByRole('tab', { name: /editor/i })).toBeNull();
    expect(screen.queryByTestId('agent-top-bar-run-options-trigger')).toBeNull();
    expect(screen.queryByTestId('agent-tracing-controls-trigger')).toBeNull();
  });

  it('keeps composer input mounted when switching into the version route panel', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/threads/thread-1', <ThreadInputRouteProbe />);

    const composer = await screen.findByRole('textbox', { name: /composer probe/i });
    fireEvent.change(composer, { target: { value: 'keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: /switch version/i }));

    expect(await screen.findByDisplayValue('keep this draft')).not.toBeNull();
  });

  it('keeps the top-bar run options control on Evaluate because there is no composer', async () => {
    server.use(...commonHandlers(enabledPackages));

    renderLayout('/agents/agent-1/evaluate');

    expect(await screen.findByTestId('agent-top-bar-run-options-trigger')).not.toBeNull();
  });
});
