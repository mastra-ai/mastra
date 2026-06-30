import type { GetAgentResponse, ListAgentVersionsResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { systemPackages } from '../../__tests__/fixtures/channels';
import { v2Agent } from '../../__tests__/fixtures/composer-model-settings';
import { AgentCapabilitiesFooter } from '../agent-capabilities-footer';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'chef-agent';

const baseAgent: GetAgentResponse = {
  ...v2Agent,
  id: AGENT_ID,
  name: 'Chef Agent',
};

const emptyVersions: ListAgentVersionsResponse = {
  versions: [],
  total: 0,
  page: 1,
  perPage: 50,
  hasMore: false,
};

// Counts the version lookups so each test can prove the editor gate works: the
// footer must only hit this endpoint when the editor is actually available.
const onVersions = vi.fn<() => void>();

function registerFooterHandlers({
  agent = baseAgent,
  cmsEnabled = false,
  versions = emptyVersions,
}: {
  agent?: GetAgentResponse;
  cmsEnabled?: boolean;
  versions?: ListAgentVersionsResponse;
} = {}) {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agent)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json({ ...systemPackages, cmsEnabled })),
    http.get(`${BASE_URL}/api/stored/agents/${AGENT_ID}/versions`, () => {
      onVersions();
      return HttpResponse.json(versions);
    }),
  );
}

function renderFooter(props: Partial<ComponentProps<typeof AgentCapabilitiesFooter>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AgentCapabilitiesFooter agentId={AGENT_ID} hasMemory {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

afterEach(() => {
  cleanup();
  onVersions.mockClear();
});

describe('AgentCapabilitiesFooter', () => {
  it('keeps the editor capability off and never fetches versions when CMS is unavailable', async () => {
    registerFooterHandlers({ cmsEnabled: false });
    renderFooter();

    const footer = await screen.findByTestId('agent-capabilities-footer');
    fireEvent.click(footer);

    // Editor reads "Off" and the gated versions query stays put.
    expect(await screen.findByRole('link', { name: 'Editor: Off' })).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onVersions).not.toHaveBeenCalled();

    // Memory links to the canonical docs page (not the retired /en/ path).
    const memoryRow = screen.getByRole('link', { name: 'Memory: On' });
    expect(memoryRow.getAttribute('href')).toBe('https://mastra.ai/docs/memory/overview');
  });

  it('enables the editor capability and fetches versions when CMS is available', async () => {
    registerFooterHandlers({ cmsEnabled: true, versions: { ...emptyVersions, total: 2 } });
    renderFooter();

    // The gate opens: the footer looks up versions exactly once...
    await waitFor(() => expect(onVersions).toHaveBeenCalledTimes(1));

    // ...and the editor row surfaces the version count.
    fireEvent.click(await screen.findByTestId('agent-capabilities-footer'));
    expect(await screen.findByRole('link', { name: 'Editor: 2' })).not.toBeNull();
  });

  it('marks the editor locked and skips the versions fetch when the agent disables editing', async () => {
    registerFooterHandlers({ cmsEnabled: true, agent: { ...baseAgent, editor: false } });
    renderFooter();

    fireEvent.click(await screen.findByTestId('agent-capabilities-footer'));
    expect(await screen.findByRole('link', { name: 'Editor: Locked' })).not.toBeNull();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onVersions).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'gateway', props: { memoryType: 'gateway' as const }, status: 'Gateway' },
    { label: 'loading', props: { isMemoryLoading: true }, status: 'Checking' },
    { label: 'disabled', props: { hasMemory: false }, status: 'Off' },
  ])('shows the memory status as "$status" ($label)', async ({ props, status }) => {
    registerFooterHandlers({ cmsEnabled: false });
    renderFooter(props);

    fireEvent.click(await screen.findByTestId('agent-capabilities-footer'));
    expect(await screen.findByRole('link', { name: `Memory: ${status}` })).not.toBeNull();
  });

  it('counts attached sub-agents and reflects them in the capability summary', async () => {
    registerFooterHandlers({
      cmsEnabled: false,
      agent: { ...baseAgent, agents: { researcher: { id: 'researcher', name: 'Researcher' } } },
    });
    renderFooter();

    // Memory (on) + Sub-agents (1) are the two enabled capabilities of six.
    const footer = await screen.findByTestId('agent-capabilities-footer');
    await waitFor(() => expect(footer.textContent).toMatch(/2\/6/));

    fireEvent.click(footer);
    expect(await screen.findByRole('link', { name: 'Sub-agents: 1' })).not.toBeNull();
  });
});
