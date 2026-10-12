import type { MastraClient } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import AgentsPage from '..';
import { noAgents } from './fixtures/agents';
import {
  agentLatencyByName,
  agentLatencyTotal,
  agentRunsOverTime,
  currentAgentRuns,
  currentQuality,
  noScorers,
  observabilityOff,
  observabilityOn,
  previousAgentRunsWithFewerErrors,
  previousQuality,
  qualityScorer,
  storageWithMetrics,
  threeAgents,
  tokensByAgent,
  tokenTotals,
} from './fixtures/agents-overview';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type Breakdown = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const ONE_HOUR_MS = 60 * 60 * 1000;
const agentNames = ['Writer Agent', 'Research Agent', 'Analysis Agent'];

function endsInThePast(body: unknown) {
  const end = JSON.stringify(body).match(/"(?:end|to)":"([^"]+)"/)?.[1];
  return end !== undefined && new Date(end).getTime() < Date.now() - ONE_HOUR_MS;
}

function serveRunMetrics({ previousRuns }: { previousRuns: Breakdown }) {
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
      const body = await request.json();
      if (JSON.stringify(body).includes('tokens')) return HttpResponse.json(tokensByAgent);
      return HttpResponse.json(endsInThePast(body) ? previousRuns : currentAgentRuns);
    }),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, () => HttpResponse.json(agentRunsOverTime)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/aggregate`, () => HttpResponse.json(tokenTotals)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/aggregate`, async ({ request }) =>
      HttpResponse.json(
        JSON.stringify(await request.json()).includes('entityName') ? agentLatencyByName : agentLatencyTotal,
      ),
    ),
  );
}

function renderAgents(initialEntry = '/agents') {
  const router = createMemoryRouter(
    [
      { path: '/agents', element: <AgentsPage /> },
      { path: '/agents/:agentId/overview', element: <output>agent</output> },
    ],
    { initialEntries: [initialEntry] },
  );
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
        <RouterProvider router={router} />
      </LinkComponentProvider>
    </TooltipProvider>,
  );
  return router;
}

function rosterOrder() {
  return screen
    .getAllByRole('link')
    .filter(link => link.closest('[data-slot=data-list]'))
    .map(link => agentNames.find(name => link.textContent?.includes(name)));
}

function rosterRow(agentName: string) {
  const row = screen
    .getAllByRole('link')
    .find(link => link.closest('[data-slot=data-list]') && link.textContent?.includes(agentName));
  if (!row) throw new Error(`No roster row for ${agentName}`);
  return row;
}

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(threeAgents)),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(observabilityOn)),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithMetrics)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
  );
  serveRunMetrics({ previousRuns: currentAgentRuns });
});

describe('Agents overview', () => {
  describe('when agents ran in the period', () => {
    it('lists the busiest agents first and idle agents last', async () => {
      renderAgents();
      await waitFor(() => expect(rosterOrder()).toEqual(['Writer Agent', 'Research Agent', 'Analysis Agent']));
      expect(rosterRow('Writer Agent').getAttribute('href')).toBe('/agents/writer/overview');
      expect(rosterRow('Analysis Agent').textContent).toContain('No runs in last 24 hours');
      expect(rosterRow('Research Agent').textContent).toContain('gpt-4o-mini · 1 tool · 0 workflows');
    });

    it('keeps idle agents last when sorting by name', async () => {
      const router = renderAgents();
      fireEvent.click(await screen.findByRole('button', { name: /^Agent, not sorted/ }));
      await waitFor(() => expect(rosterOrder()).toEqual(['Research Agent', 'Writer Agent', 'Analysis Agent']));
      expect(router.state.location.search).toContain('sort=name');
    });

    it('shows each total next to its change from the previous period', async () => {
      renderAgents();
      const totals = await screen.findByLabelText('Period totals');
      await waitFor(() => expect(within(totals).getByText('Tokens').closest('div')?.textContent).toContain('4.00K'));
      expect(within(totals).getByText('Cost').closest('div')?.textContent).toMatch(/\+100/);
      expect(within(totals).getByText('p95 latency').closest('div')?.textContent).toContain('1.1');
    });
  });

  describe('when nothing got worse than the previous period', () => {
    it('shows no attention strip', async () => {
      renderAgents();
      await waitFor(() => expect(rosterOrder()).toHaveLength(3));
      expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull();
    });
  });

  describe('when an agent fails more often than in the previous period', () => {
    it('flags it with the old and new error rates', async () => {
      serveRunMetrics({ previousRuns: previousAgentRunsWithFewerErrors });
      renderAgents();
      const attention = await screen.findByRole('region', { name: 'Needs attention' });
      expect(within(attention).getByRole('link', { name: 'Research Agent' }).getAttribute('href')).toBe(
        '/agents/researcher/overview',
      );
      expect(attention.textContent).toMatch(/error rate 40.*was 10/);
      expect(attention.textContent).not.toContain('Writer Agent');
    });
  });

  describe('when agents are scored', () => {
    it('shows the average eval score and flags a score drop', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(qualityScorer)),
        http.post(`${TEST_BASE_URL}/api/observability/scores/breakdown`, async ({ request }) =>
          HttpResponse.json(endsInThePast(await request.json()) ? previousQuality : currentQuality),
        ),
      );
      renderAgents();
      expect(await screen.findByRole('button', { name: /^Eval, not sorted/ })).toBeTruthy();
      expect(rosterRow('Writer Agent').textContent).toContain('0.70');
      const attention = await screen.findByRole('region', { name: 'Needs attention' });
      expect(attention.textContent).toContain('Quality 0.70, was 0.90');
    });
  });

  describe('when the storage cannot aggregate traces', () => {
    it('drops the p95 column', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/aggregate`, () =>
          HttpResponse.json({ error: 'Not implemented' }, { status: 501 }),
        ),
      );
      renderAgents();
      await waitFor(() => expect(rosterOrder()).toHaveLength(3));
      await waitFor(() => expect(screen.queryByRole('button', { name: /^p95,/ })).toBeNull());
    });
  });

  describe('when observability is off', () => {
    it('still lists every agent with its composition', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(observabilityOff)));
      renderAgents();
      expect(await screen.findByText('Run activity is off')).toBeTruthy();
      expect(rosterOrder()).toEqual(['Analysis Agent', 'Research Agent', 'Writer Agent']);
      expect(screen.queryByLabelText('Period totals')).toBeNull();
    });
  });

  describe('when the project has no agents', () => {
    it('explains how to add one', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)));
      renderAgents();
      expect(await screen.findByText('No Agents yet')).toBeTruthy();
    });
  });

  describe('when agents cannot be read', () => {
    it('explains the missing permission', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })),
      );
      renderAgents();
      expect((await screen.findAllByText(/permission/i)).length).toBeGreaterThan(0);
    });
  });
});
