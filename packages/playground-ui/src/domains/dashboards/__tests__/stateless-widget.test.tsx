// @vitest-environment jsdom
import { MastraClient } from '@mastra/client-js';
import type { DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { olderServerCapabilities } from '../../metrics/components/__tests__/fixtures/trace-aggregate';
import { renderInMetrics, seedMetrics, serveCapabilities } from '../../metrics/components/__tests__/metrics-msw';
import type { MetricsScope } from '../../metrics/hooks/use-metrics';
import { DashboardGridCell } from '../components/dashboard-grid';
import { DashboardRenderer } from '../components/dashboard-renderer';
import { StatelessWidget } from '../components/stateless-widget';
import { useDashboardEnvironment } from '../hooks/use-dashboard-environment';
import { BUILT_IN_WIDGET_KINDS } from '../kinds';
import type { DashboardEnvironment } from '../lib/gate';
import { planWidget } from '../lib/plan-widget';
import type { ReadyPreparedWidget } from '../lib/plan-widget';
import { prepareWidget } from '../lib/prepare-widget';
import { requestKey, sendRequest } from '../lib/requests';
import type { DashboardRequest, DashboardResult } from '../lib/requests';
import type { WidgetState } from '../widget-kind';
import {
  find,
  metricsWidget,
  normalise,
  pickIn,
  recordRequests,
  SCOPES,
  serveBreakdown,
  settle,
  TEST_NOW,
} from './equality-harness';
import type { Rendered } from './equality-harness';
import { kpisWidget, scoresWidget } from './fixtures/metrics-widgets';
import { MetricsCard, onCardHover } from '@/ds/components/MetricsCard';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

/**
 * `StatelessWidget` is what a host without React Query or a Mastra client context renders, such as
 * an MCP App. These tests play that host: they take the page's environment as plain data, plan each
 * widget with `planWidget`, send the requests with `sendRequest`, and render the answers. What it
 * shows and asks for must match `DashboardRenderer` exactly.
 */

const registry = new Map(BUILT_IN_WIDGET_KINDS.map(k => [k.kind, k]));
const CAPABILITIES = 'GET /api/observability/capabilities';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function prepared(widget: DashboardWidget, scope: MetricsScope | undefined): ReadyPreparedWidget {
  const result = prepareWidget(widget, registry, scope ? 'org' : 'project');
  if (result.ok !== true) throw new Error(`${widget.id} doesn't prepare`);
  return result;
}

/** The environment the renderer builds, sent through JSON as a host would receive it. */
async function capturedEnv(scope: MetricsScope | undefined): Promise<DashboardEnvironment> {
  const seen: { env?: DashboardEnvironment } = {};
  function Probe() {
    seen.env = useDashboardEnvironment();
    return null;
  }
  const recorder = recordRequests();
  const { unmount } = renderInMetrics(<Probe />, { scope });
  await settle(recorder);
  recorder.stop();
  unmount();
  const env = seen.env;
  if (!env) throw new Error('the environment never settled');
  expect(env.gates.trace.status).not.toBe('loading');
  const { projectLabel: _, ...data } = env;
  // Dates cross as ISO strings; the host revives them.
  const revived = JSON.parse(JSON.stringify(data), (_key, value) =>
    typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value,
  );
  return { ...revived, projectLabel: scope?.projectLabel };
}

const keyOf = (request: DashboardRequest) => JSON.stringify(requestKey(request));

/**
 * A host with no React Query: it holds the widget's state, plans its requests, sends each new one
 * once through its own client, and passes the answers back in order.
 */
function Host({ widget, env }: { widget: ReadyPreparedWidget; env: DashboardEnvironment }) {
  const client = useRef(new MastraClient({ baseUrl: TEST_BASE_URL })).current;
  const asked = useRef(new Set<string>());
  const [state, setState] = useState<WidgetState>({});
  const [answers, setAnswers] = useState<Record<string, DashboardResult>>({});
  const [attempt, setAttempt] = useState(0);
  const answersTo = (requests: (DashboardRequest | undefined)[]) =>
    requests.map(r => (r ? answers[keyOf(r)] : undefined));

  const first = planWidget(widget, env, state);
  const discover = first.status === 'ready' ? first.discover : [];
  const discovered = answersTo(discover);
  const plan = planWidget(widget, env, state, discovered);
  const requests = plan.status === 'ready' ? plan.requests : [];
  const wanted = [...discover, ...requests].filter(r => r !== undefined);
  const wantedKey = JSON.stringify(wanted.map(keyOf));

  useEffect(() => {
    for (const request of wanted) {
      const key = keyOf(request);
      if (asked.current.has(key)) continue;
      asked.current.add(key);
      const settled = (result: DashboardResult) => setAnswers(all => ({ ...all, [key]: result }));
      setAnswers(all => ({
        ...all,
        [key]: { data: all[key]?.data, isLoading: !all[key], isRefetching: !!all[key], isError: false },
      }));
      sendRequest(client, request).then(
        data => settled({ data, isLoading: false, isRefetching: false, isError: false }),
        error => settled({ isLoading: false, isRefetching: false, isError: true, error }),
      );
    }
    // `wanted` is new every render; its keys say when it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, attempt]);

  return (
    <DashboardGridCell id={widget.widget.id} span={12}>
      <StatelessWidget
        prepared={widget}
        env={env}
        state={state}
        onStateChange={setState}
        discovered={discovered}
        results={answersTo(requests)}
        onRetry={() => {
          for (const [key, result] of Object.entries(answers)) if (result.isError) asked.current.delete(key);
          setAttempt(a => a + 1);
        }}
        scope="project"
      />
    </DashboardGridCell>
  );
}

async function renderRenderer(widget: DashboardWidget, scope: MetricsScope | undefined): Promise<Rendered> {
  const recorder = recordRequests();
  const { container } = renderInMetrics(
    <DashboardRenderer
      definition={{ schemaVersion: 1, rows: [{ widgets: [widget] }] }}
      scope={scope ? 'org' : 'project'}
    />,
    { scope },
  );
  await settle(recorder);
  recorder.stop();
  return {
    root: find(container, `[data-widget-id="${widget.id}"]`),
    sent: recorder.sent.filter(r => r !== CAPABILITIES),
  };
}

async function renderHost(widget: DashboardWidget, scope: MetricsScope | undefined): Promise<Rendered> {
  const env = await capturedEnv(scope);
  const recorder = recordRequests();
  // No `MastraReactProvider`, no `QueryClientProvider`: the host's own client sends everything.
  const { container } = render(<Host widget={prepared(widget, scope)} env={env} />);
  await settle(recorder);
  recorder.stop();
  return { root: find(container, `[data-widget-id="${widget.id}"]`), sent: recorder.sent };
}

function expectSame(renderer: Rendered, host: Rendered) {
  expect(host.sent.toSorted()).toEqual(renderer.sent.toSorted());
  expect(normalise(host.root.innerHTML)).toBe(normalise(renderer.root.innerHTML));
}

async function pick(side: Rendered, view: string) {
  const recorder = recordRequests();
  pickIn(side.root, view);
  await settle(recorder);
  recorder.stop();
  return recorder.sent.filter(r => r !== CAPABILITIES);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(TEST_NOW));
  seedMetrics();
  serveBreakdown();
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(Object.entries(SCOPES))('a host rendering StatelessWidget at %s scope', (_name, scope) => {
  it.each([
    ['kpis', kpisWidget],
    ['timeseries', metricsWidget('agent-runs')],
    ['timeseries with percentiles', metricsWidget('latency')],
    ['scores', scoresWidget],
    ['table', metricsWidget('breakdown')],
  ])('sends what DashboardRenderer sends and shows what it shows for %s', async (_kind, widget) => {
    const renderer = await renderRenderer(widget, scope);
    const host = await renderHost(widget, scope);
    expect(host.sent.length).toBeGreaterThan(0);
    expectSame(renderer, host);
  });

  it.each([
    ['agent-runs', 'Failure rate'],
    ['latency', 'Workflow latency'],
    ['breakdown', 'Breakdown by model'],
  ])('switches %s to %s as the renderer does', async (id, view) => {
    const widget = metricsWidget(id);
    const renderer = await renderRenderer(widget, scope);
    renderer.sent = await pick(renderer, view);
    const host = await renderHost(widget, scope);
    host.sent = await pick(host, view);
    expectSame(renderer, host);
  });
});

describe('StatelessWidget on its own', () => {
  const env: DashboardEnvironment = {
    window: { start: new Date('2026-10-27T12:00:00Z'), end: new Date(TEST_NOW) },
    filters: { timestamp: { start: new Date('2026-10-27T12:00:00Z'), end: new Date(TEST_NOW) } },
    comparisonLabel: 'vs previous 24h',
    gates: { trace: { status: 'ready' }, span: { status: 'ready' } },
  };

  /** Every request the widget could send fails the test, so rendering it proves it sends none. */
  function recordNothing() {
    const sent: string[] = [];
    server.events.on('request:start', ({ request }) => void sent.push(`${request.method} ${request.url}`));
    return sent;
  }

  const results = (count: number, result: DashboardResult) => Array.from({ length: count }, () => result);
  const loaded = (): DashboardResult => ({ isLoading: false, isRefetching: false, isError: false });

  it('sends nothing and holds no state: a view pick only reports the next state', async () => {
    const sent = recordNothing();
    const onStateChange = vi.fn();
    const widget = prepared(metricsWidget('agent-runs'), undefined);
    const plan = planWidget(widget, env, {});
    if (plan.status !== 'ready') throw new Error('not ready');
    const { container } = render(
      <StatelessWidget
        prepared={widget}
        env={env}
        state={{}}
        onStateChange={onStateChange}
        results={results(plan.requests.length, { isLoading: true, isRefetching: false, isError: false })}
        onRetry={() => {}}
        scope="project"
      />,
    );
    const before = container.innerHTML;
    pickIn(container, 'Failure rate');
    await act(() => new Promise(r => setTimeout(r, 20)));

    expect(onStateChange).toHaveBeenCalledWith({ view: 1 });
    // Nothing changed: the host decides whether the pick takes.
    expect(container.innerHTML).toBe(before);
    expect(sent).toEqual([]);
  });

  it('plans the picked view once the host passes the new state', () => {
    const widget = prepared(metricsWidget('latency'), undefined);
    const open = planWidget(widget, env, {});
    const picked = planWidget(widget, env, { view: 1 });
    if (open.status !== 'ready' || picked.status !== 'ready') throw new Error('not ready');
    expect(picked.requests.length).toBeGreaterThan(0);
    expect(picked.requests).not.toEqual(open.requests);
  });

  it('plans the scorers it discovers before asking for their scores', () => {
    const widget = prepared(scoresWidget, undefined);
    const first = planWidget(widget, env, {});
    if (first.status !== 'ready') throw new Error('not ready');
    expect(first.discover.map(r => r?.method)).toEqual(['listScores']);
    expect(first.requests).toEqual([]);

    const discovered: DashboardResult[] = [
      {
        ...loaded(),
        data: {
          method: 'listScores',
          data: {
            scores: [
              { scorerId: 'b', scorerName: 'B' },
              { scorerId: 'a', scorerName: 'A' },
            ] as never,
            pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
          },
        },
      },
    ];
    const plan = planWidget(widget, env, {}, discovered);
    if (plan.status !== 'ready') throw new Error('not ready');
    // A mean and a series per scorer: means first, then series.
    expect(plan.requests).toHaveLength(4);
    const scorerOf = (r: DashboardRequest | undefined) => (r?.args as { scorerId?: string }).scorerId;
    expect(plan.requests.map(scorerOf)).toEqual(['a', 'b', 'a', 'b']);
  });

  it('shows a loading card while the aggregates it needs wait on capabilities', () => {
    const waiting = {
      ...env,
      gates: { trace: { status: 'loading' }, span: { status: 'loading' } },
    } as DashboardEnvironment;
    const widget = prepared(metricsWidget('breakdown'), undefined);
    expect(planWidget(widget, waiting, {}).status).toBe('pending');
    const { container } = render(
      <StatelessWidget
        prepared={widget}
        env={waiting}
        state={{}}
        onStateChange={() => {}}
        onRetry={() => {}}
        scope="project"
      />,
    );
    expect(within(container).getByText('Breakdown')).toBeDefined();
    expect(container.querySelector('[data-variant="pulse"]')).not.toBeNull();
  });

  it('renders nothing when the server has no aggregates for it', () => {
    const none = {
      ...env,
      gates: { trace: { status: 'unavailable' }, span: { status: 'unavailable' } },
    } as DashboardEnvironment;
    const widget = prepared(metricsWidget('breakdown'), undefined);
    expect(planWidget(widget, none, {}).status).toBe('hidden');
    const { container } = render(
      <StatelessWidget
        prepared={widget}
        env={none}
        state={{}}
        onStateChange={() => {}}
        onRetry={() => {}}
        scope="project"
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it.each([
    ['a chart', metricsWidget('agent-runs')],
    ['the KPI group', kpisWidget],
  ])("shows the host's actions on %s", (_, definition) => {
    const widget = prepared(definition, undefined);
    const plan = planWidget(widget, env, {});
    if (plan.status !== 'ready') throw new Error('not ready');
    render(
      <StatelessWidget
        prepared={widget}
        env={env}
        state={{}}
        onStateChange={() => {}}
        results={results(plan.requests.length, { isLoading: true, isRefetching: false, isError: false })}
        onRetry={() => {}}
        scope="project"
        actions={
          <MetricsCard.Action label="Share it" className={onCardHover}>
            <span />
          </MetricsCard.Action>
        }
      />,
    );

    expect(screen.getByRole('button', { name: 'Share it' })).toBeDefined();
  });

  it('asks the host to retry from its error card', () => {
    const onRetry = vi.fn();
    const widget = prepared(metricsWidget('breakdown'), undefined);
    const plan = planWidget(widget, env, { view: 0 });
    if (plan.status !== 'ready') throw new Error('not ready');
    render(
      <StatelessWidget
        prepared={widget}
        env={env}
        state={{ view: 0 }}
        onStateChange={() => {}}
        results={results(plan.requests.length, { ...loaded(), isError: true, error: new Error('boom') })}
        onRetry={onRetry}
        scope="project"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe('renaming from the title', () => {
    function renderRenamable(definition: DashboardWidget, onTitleChange: (title: string) => void) {
      const widget = prepared(definition, undefined);
      const plan = planWidget(widget, env, {});
      if (plan.status !== 'ready') throw new Error('not ready');
      render(
        <StatelessWidget
          prepared={widget}
          env={env}
          state={{}}
          onStateChange={() => {}}
          results={results(plan.requests.length, { isLoading: true, isRefetching: false, isError: false })}
          onRetry={() => {}}
          scope="project"
          onTitleChange={onTitleChange}
        />,
      );
    }

    it("reports a timeseries widget's new title", () => {
      const onTitleChange = vi.fn();
      const [runs] = metricsWidget('agent-runs').views;
      if (!runs) throw new Error('METRICS_DASHBOARD changed shape');
      renderRenamable({ ...metricsWidget('agent-runs'), title: 'Agent runs', views: [runs] }, onTitleChange);

      const title = screen.getByRole('textbox', { name: 'Widget title' });
      expect(title).toHaveProperty('value', 'Agent runs');
      title.focus();
      fireEvent.change(title, { target: { value: 'Runs this week' } });
      fireEvent.keyDown(title, { key: 'Enter' });
      expect(onTitleChange).toHaveBeenCalledWith('Runs this week');
    });

    it('keeps the view menu of a widget with several views', () => {
      renderRenamable(metricsWidget('agent-runs'), vi.fn());
      expect(screen.queryByRole('textbox', { name: 'Widget title' })).toBeNull();
    });
  });
});

/** Agent runs, then a trace-aggregate view: a closed view's source must not gate the open one. */
function mixedSourceWidget(): DashboardWidget {
  const [runs] = metricsWidget('agent-runs').views;
  const [ids] = metricsWidget('distinct-ids').views;
  if (!runs || !ids) throw new Error('METRICS_DASHBOARD changed shape');
  return { ...metricsWidget('agent-runs'), id: 'mixed', views: [runs, { ...ids, label: 'Resources' }] };
}

/** KPIs only ever show their first view; a second, trace-aggregate one is never open. */
function kpisWithTraceView(): DashboardWidget {
  const [first] = kpisWidget.views;
  if (!first) throw new Error('kpisWidget changed shape');
  const second: DashboardWidgetView = {
    ...first,
    queries: [...first.queries, { id: 'traces', source: 'traceAggregate', measures: ['count'] }],
  };
  return { ...kpisWidget, views: [first, second] };
}

describe('a widget whose views read different sources', () => {
  const page = {
    window: { start: new Date('2026-10-27T12:00:00Z'), end: new Date(TEST_NOW) },
    filters: { timestamp: { start: new Date('2026-10-27T12:00:00Z'), end: new Date(TEST_NOW) } },
    comparisonLabel: 'vs previous 24h',
  };

  describe('when the server has no trace aggregates', () => {
    const env: DashboardEnvironment = {
      ...page,
      gates: { trace: { status: 'unavailable' }, span: { status: 'unavailable' } },
    };

    it('plans the open metrics view and hides only the trace one', () => {
      const widget = prepared(mixedSourceWidget(), undefined);
      expect(planWidget(widget, env, {}).status).toBe('ready');
      expect(planWidget(widget, env, { view: 1 }).status).toBe('hidden');
    });

    it('plans KPIs from their first view alone', () => {
      expect(planWidget(prepared(kpisWithTraceView(), undefined), env, {}).status).toBe('ready');
    });

    it('shows the open metrics view in DashboardRenderer', async () => {
      serveCapabilities(olderServerCapabilities);
      const { root, sent } = await renderRenderer(mixedSourceWidget(), undefined);
      expect(within(root).getByText('Agent runs')).toBeDefined();
      expect(sent.some(r => r.includes('/traces/aggregate'))).toBe(false);
    });
  });

  describe('when a filter rules out trace aggregates', () => {
    const env: DashboardEnvironment = {
      ...page,
      gates: { trace: { status: 'unsupported-filter', unsupportedFields: ['serviceName'] }, span: { status: 'ready' } },
    };

    it('plans the open metrics view and blocks only the trace one', () => {
      const widget = prepared(mixedSourceWidget(), undefined);
      expect(planWidget(widget, env, {}).status).toBe('ready');
      expect(planWidget(widget, env, { view: 1 })).toEqual({
        status: 'pending',
        gate: { status: 'unsupported-filter', unsupportedFields: ['serviceName'] },
      });
    });
  });

  describe('when the server has trace aggregates', () => {
    it('loads capabilities only once the trace view is picked, and keeps the pick', async () => {
      const recorder = recordRequests();
      const { container } = renderInMetrics(
        <DashboardRenderer
          definition={{ schemaVersion: 1, rows: [{ widgets: [mixedSourceWidget()] }] }}
          scope="project"
        />,
      );
      await settle(recorder);
      expect(recorder.sent).not.toContain(CAPABILITIES);

      pickIn(find(container, '[data-widget-id="mixed"]'), 'Resources');
      await settle(recorder);
      recorder.stop();
      expect(recorder.sent).toContain(CAPABILITIES);
      expect(recorder.sent.some(r => r.includes('/traces/aggregate'))).toBe(true);
      expect(within(find(container, '[data-widget-id="mixed"]')).getByText('Resources')).toBeDefined();
    });
  });
});
