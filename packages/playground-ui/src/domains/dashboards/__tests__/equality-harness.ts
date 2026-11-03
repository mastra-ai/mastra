import type { AggregateTracesResponse, DashboardWidget } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';
import {
  agentRunsByName,
  agentRunsByProjectAndName,
  agentTokensByName,
  modelSpansByModel,
  previousAgentUsage,
  previousWithRetiredAgent,
  threadResourcesFixture,
  tokensByEnvironment,
  toolCallsByName,
  tracesByEnvironment,
  tracesByProject,
  tracesByProjectAndThread,
  tracesByThread,
  usageByModel,
  usageByThread,
} from '../../metrics/components/__tests__/fixtures/breakdown';
import { emptyBreakdownFixture } from '../../metrics/components/__tests__/fixtures/metrics';
import { aggregateCapabilities } from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import { serveCapabilities } from '../../metrics/components/__tests__/metrics-msw';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { METRICS_DASHBOARD } from '../metrics-dashboard';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

/**
 * Shared by the equality tests: something built in code next to the dashboard widgets describing it,
 * compared by the requests each sends (bodies and count) and the markup each renders.
 */

/** The tests freeze the clock here, so windows and their requests are the same on both sides. */
export const TEST_NOW = '2026-10-28T12:00:00Z';

/** A widget of `METRICS_DASHBOARD`, by id. */
export function metricsWidget(id: string): DashboardWidget {
  const found = METRICS_DASHBOARD.rows.flatMap(row => row.widgets).find(w => w.id === id);
  if (!found) throw new Error(`METRICS_DASHBOARD has no ${id} widget`);
  return found;
}

/** Breakdown's Models tab alone: a table that reads metrics only, so it waits on no capability gate. */
export function modelsWidget(): DashboardWidget {
  const breakdown = metricsWidget('breakdown');
  const models = breakdown.views.find(view => view.label === 'Breakdown by model' && view.scope === 'project');
  if (!models) throw new Error('Breakdown has no project Models tab');
  return { ...breakdown, id: 'models', views: [models] };
}

export const SCOPES: Record<'project' | 'org', MetricsScope | undefined> = {
  project: undefined,
  org: { projectLabel: (id: string) => `Project ${id}` },
};

/** Sorts object keys so two bodies with the same fields compare equal. */
export function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

/** Records every request sent while it's on, as `METHOD path?query body`. */
export function recordRequests() {
  const sent: string[] = [];
  let inFlight = 0;
  const onStart = ({ request }: { request: Request }) => {
    inFlight++;
    const url = new URL(request.url);
    const line = `${request.method} ${url.pathname}${url.search}`;
    if (request.method === 'GET') {
      sent.push(line);
      return;
    }
    void request
      .clone()
      .text()
      .then(text => sent.push(`${line} ${JSON.stringify(canonical(text ? JSON.parse(text) : null))}`));
  };
  const onEnd = () => {
    inFlight--;
  };
  server.events.on('request:start', onStart);
  server.events.on('response:mocked', onEnd);
  return {
    sent,
    idle: () => inFlight === 0,
    stop: () => {
      server.events.removeListener('request:start', onStart);
      server.events.removeListener('response:mocked', onEnd);
    },
  };
}

/**
 * MIGRATION SCAFFOLD. Comparing `innerHTML` with today's cards pins class names and markup: it proves
 * the widgets reproduce the cards while both exist, and loses its meaning once the cards are deleted.
 * Delete these comparisons with the cards; the behaviour assertions beside them are what stays.
 */
/** React's `useId` values and Recharts' chart ids differ between two trees; they say nothing about the markup. */
export const normalise = (html: string) => html.replace(/_r_[0-9a-z]+_|:r[0-9a-z]+:|recharts\d+-clip/g, 'ID');

/** Waits until nothing is in flight and the request count has stopped growing. */
export async function settle(recorder: ReturnType<typeof recordRequests>) {
  let last = -1;
  await waitFor(
    async () => {
      await act(() => new Promise(r => setTimeout(r, 20)));
      const count = recorder.sent.length;
      const stable = count === last && recorder.idle();
      last = count;
      expect(stable).toBe(true);
    },
    { timeout: 3000 },
  );
}

export type Rendered = { root: HTMLElement; sent: string[] };

export function find(container: HTMLElement, selector: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`Nothing matches ${selector}`);
  return found;
}

/** Same requests (as a multiset) and same markup. */
export function expectSame(card: Rendered, widget: Rendered) {
  expect(widget.root).not.toBeNull();
  expect(widget.sent.toSorted()).toEqual(card.sent.toSorted());
  expect(normalise(widget.root.innerHTML)).toBe(normalise(card.root.innerHTML));
}

/** Picks a view from the card's title menu. The menu portals out, but only one is open at a time. */
export function pickIn(root: HTMLElement, view: string) {
  const trigger = within(root)
    .getAllByRole('button')
    .find(b => b.getAttribute('aria-haspopup') === 'menu');
  if (!trigger) throw new Error('No title menu');
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitemradio', { name: view }));
}

async function pickInBoth(card: Rendered, widget: Rendered, view: string) {
  for (const side of [card, widget]) {
    const recorder = recordRequests();
    pickIn(side.root, view);
    await settle(recorder);
    recorder.stop();
    side.sent = recorder.sent;
  }
}

/**
 * Opens a view in both, then compares the requests that view sent and the markup it shows. For a view
 * with no data, pass the `empty` message: the card's chart stays mounted from the last view and keeps
 * its y-axis under the message, while the widget's mounts fresh after its skeleton. Same message,
 * different leftover markup, so that view compares requests and the message both show.
 */
export async function expectSameView(card: Rendered, widget: Rendered, view: string, empty?: string) {
  await pickInBoth(card, widget, view);
  if (empty === undefined) return expectSame(card, widget);
  expect(widget.sent.toSorted()).toEqual(card.sent.toSorted());
  for (const side of [card, widget]) expect(within(side.root).getByText(empty)).toBeTruthy();
}

/**
 * As `expectSameView`, for a view reading the requests the open one already answered: the card
 * mounts the view's own chart, which refetches them; the widget keeps them and sends none.
 */
export async function expectSameViewFromCache(card: Rendered, widget: Rendered, view: string) {
  await pickInBoth(card, widget, view);
  expect(card.sent.length).toBeGreaterThan(0);
  expect(widget.sent).toEqual([]);
  expect(normalise(widget.root.innerHTML)).toBe(normalise(card.root.innerHTML));
}

export const API = `${TEST_BASE_URL}/api/observability`;
const now = new Date(TEST_NOW).getTime();
/** Whether a window ends now (the page's) rather than a window earlier (the previous one). */
export const endsNow = (end: unknown) => Math.abs(now - new Date(String(end)).getTime()) < 3_600_000;
const noRows: AggregateTracesResponse = { rows: [], truncated: false };

/** The parts of an aggregate request body these handlers route on. */
export type AggregateBody = { groupBy?: string[]; measures?: string[]; where?: unknown; timeRange: { to: string } };
/** The parts of a metrics request body these handlers route on. */
export type MetricsBody = {
  name?: string | string[];
  groupBy?: string[];
  aggregation?: string;
  filters?: { timestamp?: { end?: string } };
};

/**
 * Breakdown's answers, by what a request groups on and which window it covers. Neither card nor
 * widget is told which tab asked: the same body gets the same answer.
 */
export function serveBreakdown() {
  serveCapabilities(aggregateCapabilities);
  server.use(
    http.post<never, AggregateBody>(`${API}/traces/aggregate`, async ({ request }) => {
      const body = await request.json();
      const by = (body.groupBy ?? []).join();
      if (by === 'projectId') return HttpResponse.json(tracesByProject(['p1', 'p2']));
      if (by.endsWith('environment')) return HttpResponse.json(tracesByEnvironment);
      if (by === 'resourceId,threadId')
        return HttpResponse.json(body.measures?.length === 1 ? threadResourcesFixture : tracesByThread);
      if (by === 'projectId,threadId') return HttpResponse.json(tracesByProjectAndThread);
      return HttpResponse.json(noRows);
    }),
    http.post<never, AggregateBody>(`${API}/spans/aggregate`, async ({ request }) => {
      const body = await request.json();
      const current = endsNow(body.timeRange.to);
      if (JSON.stringify(body.where).includes('tool_call'))
        return HttpResponse.json(current ? toolCallsByName : noRows);
      if (!JSON.stringify(body.where).includes('agent_run')) return HttpResponse.json(noRows);
      if (body.groupBy?.[0] === 'projectId') return HttpResponse.json(agentRunsByProjectAndName);
      return HttpResponse.json(current ? agentRunsByName : previousWithRetiredAgent);
    }),
    http.post<never, MetricsBody>(`${API}/metrics/breakdown`, async ({ request }) => {
      const body = await request.json();
      const current = endsNow(body.filters?.timestamp?.end);
      const by = body.groupBy?.at(-1);
      if (body.aggregation === 'count')
        return HttpResponse.json(by === 'model' ? modelSpansByModel : emptyBreakdownFixture);
      if (by === 'entityName') return HttpResponse.json(current ? agentTokensByName : previousAgentUsage);
      if (by === 'environment') return HttpResponse.json(tokensByEnvironment);
      if (by === 'model') return HttpResponse.json(usageByModel);
      if (by === 'threadId') return HttpResponse.json(usageByThread);
      return HttpResponse.json(emptyBreakdownFixture);
    }),
  );
}

/** Breakdown's views, by what each breaks down by, in an order that leaves the one it opens on for last. */
export const BREAKDOWN_VIEWS = {
  project: ['workflow', 'tool', 'model', 'thread', 'environment', 'agent'],
  org: ['agent', 'workflow', 'tool', 'model', 'thread', 'environment', 'project'],
};
