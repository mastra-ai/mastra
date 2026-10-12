import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeAllowedCapabilities } from '../../hooks/__tests__/fixtures/auth';
import { AgentNavigationHeader } from '../agent-navigation-header';
import { AgentsSidebarList } from '../agents-sidebar-list';
import { RememberRecentAgent } from '../recent-agents';
import { agentsList } from '@/pages/agents/__tests__/fixtures/agents';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// Base UI popups don't open in jsdom; a native select exposes the same contract.
vi.mock('@mastra/playground-ui/components/Combobox', () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
    'aria-label': ariaLabel,
  }: {
    options: Array<{ label: string; value: string }>;
    value?: string;
    onValueChange?: (value: string) => void;
    'aria-label'?: string;
  }) => (
    <select aria-label={ariaLabel} value={value} onChange={event => onValueChange?.(event.target.value)}>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agentsList)),
    http.get(`${TEST_BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)),
  );
});

const routed = { router: true };

async function visit(...agentIds: string[]) {
  for (const agentId of agentIds) {
    const { unmount } = renderWithProviders(<RememberRecentAgent agentId={agentId} />, routed);
    await waitFor(() =>
      expect(Object.keys(localStorage).some(key => localStorage.getItem(key)?.startsWith(`["${agentId}"`))).toBe(true),
    );
    unmount();
  }
}

async function switcherOptions() {
  const switcher = await screen.findByRole('combobox', { name: 'Switch agent' });
  await waitFor(() => expect(within(switcher).getAllByRole('option').length).toBeGreaterThan(0));
  return within(switcher)
    .getAllByRole('option')
    .map(option => option.textContent);
}

describe('AgentNavigationHeader', () => {
  describe('when switching agents from chat', () => {
    it('lists recently opened agents before the rest and pinned agents before both', async () => {
      await visit('researcher', 'analyst');
      renderWithProviders(
        <TestLinkProvider>
          <AgentsSidebarList search="" />
          <AgentNavigationHeader agentId="analyst" view="chat" />
        </TestLinkProvider>,
        routed,
      );
      expect(await switcherOptions()).toEqual(['Analysis Agent', 'Research Agent']);

      fireEvent.click(await screen.findByRole('button', { name: 'Pin Research Agent' }));
      await waitFor(async () => expect(await switcherOptions()).toEqual(['Research Agent', 'Analysis Agent']));
    });

    it('omits recently opened agents the server no longer has', async () => {
      await visit('removed-agent');
      renderWithProviders(
        <TestLinkProvider>
          <AgentNavigationHeader agentId="researcher" view="chat" />
        </TestLinkProvider>,
        routed,
      );
      expect(await switcherOptions()).toEqual(['Research Agent', 'Analysis Agent']);
    });
  });
  describe('when inspecting an agent workspace', () => {
    it('shows the active agent and its configured model', async () => {
      renderWithProviders(
        <TestLinkProvider>
          <AgentNavigationHeader agentId="researcher" view="agent" />
        </TestLinkProvider>,
        routed,
      );
      const activeAgent = await screen.findByRole('navigation', { name: 'Active agent' });
      expect(within(activeAgent).getByRole('link', { name: 'Research Agent' }).getAttribute('aria-current')).toBe(
        'page',
      );
      expect(within(activeAgent).getByText('gpt-4o-mini')).toBeTruthy();
    });
  });
});
