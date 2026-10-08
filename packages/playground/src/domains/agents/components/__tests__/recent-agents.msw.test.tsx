import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { writeAllowedCapabilities } from '../../hooks/__tests__/fixtures/auth';
import { RecentAgents } from '../recent-agents';
import { agentsList } from '@/pages/agents/__tests__/fixtures/agents';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agentsList)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)),
  );
});

const navigation = (agentId: string) => (
  <TestLinkProvider>
    <RecentAgents key={agentId} agentId={agentId} />
  </TestLinkProvider>
);

describe('RecentAgents', () => {
  describe('when visiting an agent for the first time', () => {
    it('offers the current agent and a path back to all agents', async () => {
      renderWithProviders(navigation('researcher'));
      expect((await screen.findByRole('link', { name: 'Research Agent' })).getAttribute('href')).toBe(
        '/chat/researcher',
      );
      expect(screen.getByRole('link', { name: 'All agents' }).getAttribute('href')).toBe('/chat/agents');
    });
  });
  describe('when switching between agents', () => {
    it('keeps previously visited agents in most recently opened order', async () => {
      const { rerender } = renderWithProviders(navigation('analyst'));
      await screen.findByRole('link', { name: 'Analysis Agent' });
      rerender(navigation('researcher'));
      await screen.findByRole('link', { name: 'Research Agent' });
      const section = screen.getByRole('navigation', { name: 'Recent agents' });
      expect(
        within(section)
          .getAllByRole('link')
          .map(link => link.textContent),
      ).toEqual(['Research Agent', 'Analysis Agent']);
    });
  });
  describe('when an agent is removed from the server', () => {
    it('omits stale destinations from the recent list', async () => {
      const { rerender, queryClient } = renderWithProviders(navigation('analyst'));
      await screen.findByRole('link', { name: 'Analysis Agent' });
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({ researcher: agentsList.researcher })),
      );
      queryClient.clear();
      rerender(navigation('researcher'));
      await screen.findByRole('link', { name: 'Research Agent' });
      expect(screen.queryByRole('link', { name: 'Analysis Agent' })).toBeNull();
    });
  });
});
