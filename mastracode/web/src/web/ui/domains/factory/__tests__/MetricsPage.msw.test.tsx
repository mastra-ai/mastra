/**
 * BDD coverage for the Factory Metrics page.
 *
 * Drives the real route table through a memory router with the full provider
 * stack, so the specs exercise what a user sees at /factory/metrics: the flow
 * dashboard fed by the server's aggregation endpoint. Only the network is
 * mocked (MSW).
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/web-ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/web-ui/render';
import type { GithubStatus, Factory } from '../../workspaces';
import { createAppRoutes } from '../../../router';
import type { FactoryMetrics } from '../services/metrics';

const API = `${TEST_BASE_URL}/api/agent-controller/code`;
const RESOURCE_ID = 'resource-gh';
const SESSION = `${API}/sessions/${RESOURCE_ID}`;
const THREAD_ID = 'thread-test';
const FACTORY_PROJECT_ID = 'fp-1';

const githubProject: Factory = {
  id: 'project-gh',
  name: 'Mastra',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: FACTORY_PROJECT_ID,
    repositories: [
      {
        projectRepositoryId: 'pr-1',
        slug: 'mastra-ai/mastra',
        gitBranch: 'main',
        sandboxWorkdir: '/sandbox/mastra',
        selectedWorktreePath: '/sandbox/mastra',
        worktrees: [{ branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' }],
      },
    ],
  },
};

const localProject: Factory = {
  id: 'project-local',
  name: 'Local',
  resourceId: RESOURCE_ID,
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/projects/local',
  },
};

const connectedStatus: GithubStatus = {
  enabled: true,
  connected: true,
  installations: [{ installationId: 1, accountLogin: 'mastra-ai', accountType: 'Organization' }],
};

const HOUR = 3_600_000;

/** A realistic aggregation payload, as the server would compute it. */
function makeMetrics(overrides: Partial<FactoryMetrics> = {}): FactoryMetrics {
  return {
    windowDays: 30,
    earliestItemAt: '2026-05-01T00:00:00.000Z',
    throughput: [
      { date: '2026-07-14', count: 2 },
      { date: '2026-07-15', count: 1 },
    ],
    cycleTime: { medianMs: 3 * HOUR, p90Ms: 8 * HOUR, samples: 3 },
    stageDurations: [
      { stage: 'execute', medianMs: 4 * HOUR, samples: 5 },
      { stage: 'review', medianMs: 2 * HOUR, samples: 4 },
    ],
    wip: [
      { stage: 'execute', count: 2 },
      { stage: 'review', count: 1 },
    ],
    wipTotal: 3,
    agingWip: [
      {
        id: 'wi-1',
        title: 'Fix flaky test',
        stage: 'review',
        enteredAt: '2026-07-12T00:00:00Z',
        url: 'https://github.com/mastra-ai/mastra/issues/12',
      },
      { id: 'wi-2', title: 'Manual chore', stage: 'execute', enteredAt: '2026-07-14T00:00:00Z', url: null },
    ],
    sourceMix: [
      { source: 'github-issue', count: 4 },
      { source: 'manual', count: 1 },
    ],
    transitions: { human: 2, total: 6 },
    stageAutomation: [
      { stage: 'triage', exits: 4, automated: 2, outcomes: { done: 1, canceled: 0, reworked: 1, inFlight: 0 } },
      { stage: 'planning', exits: 3, automated: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
    ],
    ...overrides,
  };
}

function emptySse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start() {},
      cancel() {},
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

function sessionState() {
  return {
    controllerId: 'code',
    resourceId: RESOURCE_ID,
    modeId: 'build',
    modelId: 'openai/gpt-4o-mini',
    threadId: THREAD_ID,
    settings: { yolo: false, thinkingLevel: 'medium', notifications: 'bell', smartEditing: true },
  };
}

interface MetricsState {
  /** `from`/`to` query params of every metrics request, in order. */
  requestedRanges: { from: string; to: string }[];
}

/** Whole-day span of a requested range. */
function spanDays(range: { from: string; to: string }): number {
  return Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000);
}

function useMetricsHandlers(metrics: FactoryMetrics = makeMetrics()): MetricsState {
  const state: MetricsState = { requestedRanges: [] };
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => new Response(null, { status: 404 })),
    http.get(`${TEST_BASE_URL}/web/github/status`, () => HttpResponse.json(connectedStatus)),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: [] }, linear: { enabled: false, sourceIds: [] } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.post(`${API}/sessions`, () =>
      HttpResponse.json({ controllerId: 'code', resourceId: RESOURCE_ID, threadId: THREAD_ID }),
    ),
    http.get(`${API}/modes`, () => HttpResponse.json({ modes: [{ id: 'build', label: 'Build' }] })),
    http.get(`${API}/models`, () => HttpResponse.json({ models: [] })),
    http.get(SESSION, () => HttpResponse.json(sessionState())),
    http.put(`${SESSION}/state`, () => HttpResponse.json(sessionState())),
    http.get(`${SESSION}/permissions`, () => HttpResponse.json({ categories: {}, tools: {} })),
    http.get(`${SESSION}/threads`, () => HttpResponse.json({ threads: [] })),
    http.get(`${SESSION}/threads/${THREAD_ID}/messages`, () => HttpResponse.json({ messages: [] })),
    http.get(`${SESSION}/stream`, () => emptySse()),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_PROJECT_ID}/metrics`, ({ request }) => {
      const url = new URL(request.url);
      const range = { from: url.searchParams.get('from') ?? '', to: url.searchParams.get('to') ?? '' };
      state.requestedRanges.push(range);
      const days = spanDays(range);
      return HttpResponse.json({
        metrics: { ...metrics, windowDays: Number.isFinite(days) ? days : metrics.windowDays },
      });
    }),
  );
  return state;
}

function renderAt(project: Factory = githubProject) {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${project.id}/metrics`] });
  renderWithProviders(<RouterProvider router={router} />, client);
  return { router, client };
}

afterEach(() => {
  localStorage.clear();
});

describe('Factory Metrics page', () => {
  it('given aggregated metrics, when the page renders, then stat cards, stages, aging items, and source mix appear', async () => {
    useMetricsHandlers(
      makeMetrics({
        // 'blocked' exists only in wip (no duration samples, not a board column):
        // it must still show up in the stage breakdown.
        wip: [
          { stage: 'execute', count: 2 },
          { stage: 'review', count: 1 },
          { stage: 'blocked', count: 1 },
        ],
        wipTotal: 4,
      }),
    );
    renderAt();

    expect(await screen.findByRole('group', { name: 'Date range timeline' })).toBeInTheDocument();

    // Stat cards: throughput total, cycle time (with p90 hint), WIP, live agents.
    const completed = (await screen.findByText('Completed')).parentElement!;
    expect(within(completed).getByText('3')).toBeInTheDocument();
    const cycle = screen.getByText('Median cycle time').parentElement!;
    expect(within(cycle).getByText('3h')).toBeInTheDocument();
    expect(within(cycle).getByText('p90 8h')).toBeInTheDocument();
    const inFlight = screen.getByText('In flight').parentElement!;
    expect(within(inFlight).getByText('4')).toBeInTheDocument();
    const agents = screen.getByText('Agents running').parentElement!;
    expect(within(agents).getByText('0')).toBeInTheDocument();

    // Stage breakdown uses the board vocabulary and shows dwell + column counts.
    const stages = screen.getByRole('heading', { name: 'Stages' }).parentElement!;
    expect(within(stages).getByText('Building')).toBeInTheDocument();
    expect(within(stages).getByText(/median 4h · 2 in column/)).toBeInTheDocument();
    expect(within(stages).getByText(/median 2h · 1 in column/)).toBeInTheDocument();
    // Stages without samples still render with their current WIP count.
    expect(within(stages).getByText('Intake')).toBeInTheDocument();
    // A WIP-only stage outside the board vocabulary still gets a row.
    expect(within(stages).getByText('blocked')).toBeInTheDocument();

    // Aging WIP: linked titles when a source URL exists, plain text otherwise.
    const aging = screen.getByRole('heading', { name: 'Oldest in-flight items' }).parentElement!;
    expect(within(aging).getByRole('link', { name: 'Fix flaky test' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/issues/12',
    );
    expect(within(aging).getByText('Manual chore')).toBeInTheDocument();

    // Source mix with human-readable labels.
    const sources = screen.getByRole('heading', { name: 'Source mix' }).parentElement!;
    expect(within(sources).getByText('GitHub issues')).toBeInTheDocument();
    expect(within(sources).getByText('4')).toBeInTheDocument();
    expect(within(sources).getByText('Manual')).toBeInTheDocument();
  });

  it('given mixed automation, when the page renders, then the automated-moves stat and per-stage rows appear', async () => {
    useMetricsHandlers();
    renderAt();

    // Global stat: total - human automated moves, with the window total as hint.
    const automatedMoves = (await screen.findByText('Automated moves (30d)')).parentElement!;
    expect(within(automatedMoves).getByText('4')).toBeInTheDocument();
    expect(within(automatedMoves).getByText('of 6 stage moves')).toBeInTheDocument();

    // Per-stage rows: automated % over exits, plus the outcome split of
    // automated passes (zero buckets omitted).
    const section = screen.getByRole('heading', { name: 'Automation by stage' }).parentElement!;
    expect(within(section).getByText(/50% automated \(2\/4\) · 1 done, 1 reworked/)).toBeInTheDocument();
    expect(within(section).getByText(/0% automated \(0\/3\)/)).toBeInTheDocument();
    // Board stages with no exits in the window render an em dash.
    const building = within(section).getByText('Building').closest('li')!;
    expect(within(building as HTMLElement).getByText('—')).toBeInTheDocument();
    // Terminal stages never get automation rows.
    expect(within(section).queryByText('Done')).not.toBeInTheDocument();
    expect(within(section).queryByText('Canceled')).not.toBeInTheDocument();
  });

  it('given the default window, when the page renders, then the timeline drives a 30-day fetch', async () => {
    const state = useMetricsHandlers();
    renderAt();

    expect(await screen.findByText('Completed')).toBeInTheDocument();
    // The draggable date-range timeline is the window control.
    expect(screen.getByRole('group', { name: 'Date range timeline' })).toBeInTheDocument();
    // Initial fetch covers the default last-30-days window (inclusive end-of-day).
    expect(state.requestedRanges).toHaveLength(1);
    expect(spanDays(state.requestedRanges[0])).toBeGreaterThanOrEqual(30);
    expect(spanDays(state.requestedRanges[0])).toBeLessThanOrEqual(31);
  });

  it('given an empty board, when the page renders, then friendly empty states appear', async () => {
    useMetricsHandlers(
      makeMetrics({
        throughput: [{ date: '2026-07-15', count: 0 }],
        cycleTime: { medianMs: null, p90Ms: null, samples: 0 },
        stageDurations: [],
        wip: [],
        wipTotal: 0,
        agingWip: [],
        sourceMix: [],
        transitions: { human: 0, total: 0 },
        stageAutomation: [],
      }),
    );
    renderAt();

    expect(await screen.findByText('Nothing in flight — the board is clear.')).toBeInTheDocument();
    expect(screen.getByText('No items created in this window.')).toBeInTheDocument();
    // Null cycle time renders as an em dash instead of a bogus number.
    const cycle = screen.getByText('Median cycle time').parentElement!;
    expect(within(cycle).getByText('—')).toBeInTheDocument();
    // Zero stage moves: the automated-moves stat renders an em dash too.
    const automatedMoves = screen.getByText('Automated moves (30d)').parentElement!;
    expect(within(automatedMoves).getByText('—')).toBeInTheDocument();
    // No completed passes anywhere: the automation section shows its empty state.
    expect(screen.getByText('No completed stage passes in this window yet.')).toBeInTheDocument();
  });

  it('given a local project, when visiting Metrics, then the server-factory notice renders instead of the dashboard', async () => {
    useMetricsHandlers();
    renderAt(localProject);

    expect(
      await screen.findByText(/Board, metrics, rules, and audit are available for server-backed Factories/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Median cycle time')).not.toBeInTheDocument();
  });
});
