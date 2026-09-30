import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ToolUsedBy } from '../tool-used-by';
import { agentsWithoutTools, agentsWithRefundUser } from './fixtures/tool-agents';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const renderUsedBy = (currentAgentId?: string) =>
  renderWithProviders(
    <TestLinkProvider>
      <ToolUsedBy toolId="refundUser" currentAgentId={currentAgentId} />
    </TestLinkProvider>,
  );

const serveAgents = (agents: typeof agentsWithRefundUser) =>
  server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)));

describe('ToolUsedBy', () => {
  describe('when opened from the global tools page', () => {
    it('lists only the agents that have the tool', async () => {
      serveAgents(agentsWithRefundUser);
      renderUsedBy();

      expect(await screen.findByRole('link', { name: 'Billing Agent' })).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Support Agent' })).not.toBeNull();
      expect(screen.queryByText('Chef Agent')).toBeNull();
    });

    it('links each agent to its own page', async () => {
      serveAgents(agentsWithRefundUser);
      renderUsedBy();

      const link = await screen.findByRole('link', { name: 'Billing Agent' });
      expect(link.getAttribute('href')).toBe('/agents/billing-agent');
    });
  });

  describe('when opened from one of the agents that use it', () => {
    it('shows that agent as the current one instead of a link', async () => {
      serveAgents(agentsWithRefundUser);
      renderUsedBy('billing-agent');

      const current = await screen.findByRole('button', { name: /Billing Agent/ });
      expect(current.hasAttribute('disabled')).toBe(true);
      expect(screen.getByText('Current')).not.toBeNull();
      expect(screen.queryByRole('link', { name: 'Billing Agent' })).toBeNull();
    });
  });

  describe('when no agent uses the tool', () => {
    it('says so', async () => {
      serveAgents(agentsWithoutTools);
      renderUsedBy();

      expect(await screen.findByText('No agents use this tool.')).not.toBeNull();
    });
  });

  describe('when the agents request fails', () => {
    it('says the agents could not be loaded instead of claiming none use the tool', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
      renderUsedBy();

      expect(await screen.findByText("Couldn't load the agents that use this tool.")).not.toBeNull();
      expect(screen.queryByText('No agents use this tool.')).toBeNull();
    });
  });
});
