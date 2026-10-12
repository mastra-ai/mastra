import type { GetAgentResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentDetailHeaderActions } from '../agent-detail-header-actions';
import { v2Agent } from './fixtures/composer-model-settings';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGENT_ID = 'agent-1';
const storedAgent: GetAgentResponse = { ...v2Agent, source: 'stored' };

function installHandlers(agent: GetAgentResponse = v2Agent) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(agent)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json({ packages: [] })),
    http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({})),
  );
}

function renderActions() {
  return renderWithProviders(
    <TestLinkProvider>
      <TooltipProvider>
        <div data-testid="header-actions">
          <AgentDetailHeaderActions agentId={AGENT_ID} />
        </div>
      </TooltipProvider>
    </TestLinkProvider>,
    { router: true },
  );
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  delete (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI;
});

describe('AgentDetailHeaderActions', () => {
  it('renders Share inside the route header slot', async () => {
    installHandlers();
    renderActions();

    const slot = screen.getByTestId('header-actions');
    await waitFor(() => expect(slot.querySelector('[data-testid="agent-entity-header-share"]')).not.toBeNull());
  });

  it('hides the Edit button for code-defined agents', async () => {
    (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI = 'true';
    installHandlers();
    renderActions();

    await screen.findByTestId('agent-entity-header-share');
    await waitFor(() => expect(screen.queryByText('Edit')).toBeNull());
  });

  it('shows the Edit button for stored agents when the user can create agents', async () => {
    (window as unknown as Record<string, unknown>).MASTRA_EXPERIMENTAL_UI = 'true';
    installHandlers(storedAgent);
    renderActions();

    const edit = await screen.findByText('Edit');
    expect(edit.closest('a')?.getAttribute('href')).toBe(`/cms/agents/${AGENT_ID}`);
  });
});
