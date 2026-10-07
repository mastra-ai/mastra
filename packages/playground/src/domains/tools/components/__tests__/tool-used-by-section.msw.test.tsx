import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ToolUsedBySection } from '../tool-drawer/tool-used-by-section';
import { agentsWithoutTools, agentsWithRefundUser } from './fixtures/tool-agents';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderUsedBy = (currentAgentId?: string) =>
  renderWithProviders(
    <TestLinkProvider>
      <ToolUsedBySection toolId="refundUser" currentAgentId={currentAgentId} />
    </TestLinkProvider>,
  );

const serveAgents = (agents: typeof agentsWithRefundUser) =>
  server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)));

describe('ToolUsedBySection', () => {
  describe('when opened from the global tools page', () => {
    it('lists only the agents that have the tool', async () => {
      serveAgents(agentsWithRefundUser);
      renderUsedBy();

      expect(await screen.findByText('Billing Agent')).not.toBeNull();
      expect(screen.getByText('Support Agent')).not.toBeNull();
      expect(screen.queryByText('Chef Agent')).toBeNull();
    });

    it('links each agent to its own page', async () => {
      serveAgents(agentsWithRefundUser);
      renderUsedBy();

      const links = await screen.findAllByRole('link');
      expect(links.map(link => link.getAttribute('href'))).toEqual(['/agents/billing-agent', '/agents/support-agent']);
      expect(links.map(link => link.textContent)).toEqual(['Billing Agent', 'Support Agent']);
    });
  });

  describe('when opened from one of the agents that use it', () => {
    it('shows that agent as the current one instead of a link', async () => {
      serveAgents(agentsWithRefundUser);
      renderUsedBy('billing-agent');

      expect(await screen.findByText('Current')).not.toBeNull();
      expect(screen.getByText('Billing Agent')).not.toBeNull();
      // Only the other agent's row is a link.
      expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Support Agent']);
    });
  });

  describe('when no agent uses the tool', () => {
    it('says so', async () => {
      serveAgents(agentsWithoutTools);
      renderUsedBy();

      expect(await screen.findByText('No agents use this tool yet.')).not.toBeNull();
    });
  });

  describe('when the agents request fails', () => {
    it('says the agents could not be loaded instead of claiming none use the tool', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
      renderUsedBy();

      expect(await screen.findByText("Couldn't load the agents that use this tool.")).not.toBeNull();
      expect(screen.queryByText('No agents use this tool yet.')).toBeNull();
    });
  });
});
