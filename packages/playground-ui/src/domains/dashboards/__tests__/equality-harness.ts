import type { AggregateTracesResponse, DashboardWidget } from '@mastra/client-js';
import { act, fireEvent, waitFor, within } from '@testing-library/react';
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

/** React's `useId` values and Recharts' clip-path ids differ between two trees; they say nothing about the markup. */
export const normalise = (html: string) =>
  html.replace(/_r_[0-9a-z]+_|:r[0-9a-z]+:/g, 'ID').replace(/recharts\d+-/g, 'recharts-');

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

/**
 * Opens a tab in both, then compares the requests that tab sent and the markup it shows. With
 * `requests: false` (a tab opened again), only the markup: whether a revisit refetches is a cache detail.
 */
export async function expectSameTab(card: Rendered, widget: Rendered, tab: string, { requests = true } = {}) {
  for (const side of [card, widget]) {
    const recorder = recordRequests();
    fireEvent.click(within(side.root).getByRole('tab', { name: tab }));
    await settle(recorder);
    recorder.stop();
    side.sent = recorder.sent;
  }
  if (requests) expectSame(card, widget);
  else expectSame({ ...card, sent: [] }, { ...widget, sent: [] });
}

export const API = `${TEST_BASE_URL}/api/observability`;
const now = new Date(TEST_NOW).getTime();
/** Whether a window ends now (the page's) rather than a window earlier (the previous one). */
const endsNow = (end: unknown) => Math.abs(now - new Date(String(end)).getTime()) < 3_600_000;
export const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const noRows: AggregateTracesResponse = { rows: [] };

/**
 * Breakdown's answers, by what a request groups on and which window it covers. Neither card nor
 * widget is told which tab asked: the same body gets the same answer.
 */
export function serveBreakdown() {
  serveCapabilities(aggregateCapabilities);
  server.use(
    http.post(`${API}/traces/aggregate`, async ({ request }) => {
      const body = record(await request.json());
      const by = (body.groupBy as string[]).join();
      if (by === 'projectId') return HttpResponse.json(tracesByProject(['p1', 'p2']));
      if (by.endsWith('environment')) return HttpResponse.json(tracesByEnvironment);
      if (by === 'resourceId,threadId')
        return HttpResponse.json((body.measures as string[]).length === 1 ? threadResourcesFixture : tracesByThread);
      if (by === 'projectId,threadId') return HttpResponse.json(tracesByProjectAndThread);
      return HttpResponse.json(noRows);
    }),
    http.post(`${API}/spans/aggregate`, async ({ request }) => {
      const body = record(await request.json());
      const current = endsNow(record(body.timeRange).to);
      if (JSON.stringify(body.where).includes('tool_call'))
        return HttpResponse.json(current ? toolCallsByName : noRows);
      if (!JSON.stringify(body.where).includes('agent_run')) return HttpResponse.json(noRows);
      if ((body.groupBy as string[])[0] === 'projectId') return HttpResponse.json(agentRunsByProjectAndName);
      return HttpResponse.json(current ? agentRunsByName : previousWithRetiredAgent);
    }),
    http.post(`${API}/metrics/breakdown`, async ({ request }) => {
      const body = record(await request.json());
      const current = endsNow(record(record(body.filters).timestamp).end);
      const by = (body.groupBy as string[]).at(-1);
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

export const BREAKDOWN_TABS = {
  project: ['Workflows', 'Tools', 'Models', 'Threads', 'Environments', 'Agents'],
  org: ['Agents', 'Workflows', 'Tools', 'Models', 'Threads', 'Environments', 'Projects'],
};
