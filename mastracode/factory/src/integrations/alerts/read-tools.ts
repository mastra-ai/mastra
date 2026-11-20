import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** Platform's response to `POST /v1/server/alerts/incidents/:id/observability-token`. */
export interface AlertReadToken {
  token: string;
  region: 'us' | 'eu';
  observabilityBaseUrl: string;
  projectId: string | null;
  expiresAt: string;
  /** The incident's project in the dashboard; its pages are where a human checks the evidence. */
  dashboardUrl?: string;
}

export interface AlertReadClientDeps {
  mint: (incidentId: string) => Promise<AlertReadToken>;
  fetch?: typeof fetch;
  now?: () => number;
}

const REFRESH_BEFORE_EXPIRY_MS = 2 * 60_000;
const READ_PATH = '/alert-read/observability';

/**
 * Reads an incident's observability data with a short-lived, region-bound token minted per
 * incident. The token's own base URL is used, so a US incident is read from the US region
 * only. Re-mints when under two minutes remain, and once on a 401.
 */
export class AlertReadClient {
  readonly #deps: AlertReadClientDeps;
  readonly #tokens = new Map<string, AlertReadToken>();

  constructor(deps: AlertReadClientDeps) {
    this.#deps = deps;
  }

  async read(
    organizationId: string,
    incidentId: string,
    request: { method: 'GET' | 'POST'; path: string; query?: Record<string, string>; body?: unknown },
  ): Promise<unknown> {
    let token = await this.#token(incidentId, false);
    let response = await this.#send(organizationId, token, request);
    if (response.status === 401) {
      token = await this.#token(incidentId, true);
      response = await this.#send(organizationId, token, request);
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`Observability read failed (${response.status}): ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  /** The dashboard root for an incident whose token has been minted. */
  dashboardUrl(incidentId: string): string | null {
    return this.#tokens.get(incidentId)?.dashboardUrl?.replace(/\/$/, '') ?? null;
  }

  async #token(incidentId: string, force: boolean): Promise<AlertReadToken> {
    const now = (this.#deps.now ?? Date.now)();
    const cached = this.#tokens.get(incidentId);
    if (!force && cached && Date.parse(cached.expiresAt) - now > REFRESH_BEFORE_EXPIRY_MS) return cached;
    const minted = await this.#deps.mint(incidentId);
    this.#tokens.set(incidentId, minted);
    return minted;
  }

  #send(
    organizationId: string,
    token: AlertReadToken,
    request: { method: 'GET' | 'POST'; path: string; query?: Record<string, string>; body?: unknown },
  ): Promise<Response> {
    const query =
      request.query && Object.keys(request.query).length > 0 ? `?${new URLSearchParams(request.query)}` : '';
    const url = `${token.observabilityBaseUrl.replace(/\/$/, '')}${READ_PATH}${request.path}${query}`;
    const headers: Record<string, string> = {
      authorization: `Bearer ${token.token}`,
      'x-mastra-organization-id': organizationId,
    };
    if (token.projectId) headers['x-mastra-project-id'] = token.projectId;
    if (request.body !== undefined) headers['content-type'] = 'application/json';
    return (this.#deps.fetch ?? fetch)(url, {
      method: request.method,
      headers,
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
    });
  }
}

/** Trace and log filters the dashboard reads from its URL, by field (playground-ui's own maps). */
const SHARED_FILTER_PARAMS: Record<string, string> = {
  tags: 'filterTags',
  entityName: 'filterEntityName',
  traceId: 'filterTraceId',
  runId: 'filterRunId',
  threadId: 'filterThreadId',
  sessionId: 'filterSessionId',
  requestId: 'filterRequestId',
  resourceId: 'filterResourceId',
  userId: 'filterUserId',
  organizationId: 'filterOrganizationId',
  serviceName: 'filterServiceName',
  environment: 'filterEnvironment',
  experimentId: 'filterExperimentId',
  rootEntityType: 'rootEntityType',
};
const DASHBOARD_FILTER_PARAMS: Record<'traces' | 'logs', Record<string, string>> = {
  traces: {
    ...SHARED_FILTER_PARAMS,
    status: 'status',
    entityId: 'filterEntityId',
    durationMs: 'filterDurationMs',
    outcome: 'filterOutcome',
    stopReason: 'filterStopReason',
    'spans.name': 'filterSpanName',
    'spans.spanType': 'filterSpanType',
    'spans.model': 'filterSpanModel',
    'spans.provider': 'filterSpanProvider',
    'spans.error': 'filterSpanError',
  },
  logs: { ...SHARED_FILTER_PARAMS, level: 'filterLevel', spanId: 'filterSpanId' },
};

/**
 * A read's filters as the dashboard list page's URL params: a date range as `dateFrom`/`dateTo`,
 * each field the page filters on under the param it reads (`level` → `filterLevel`, `status` →
 * `status`). Paging and fields the page has no filter for are dropped: a broader link beats one
 * the page ignores.
 */
export function dashboardSearch(page: 'traces' | 'logs', filters: Record<string, string> | undefined): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters ?? {})) {
    const range = /^(.*)\.(start|end)$|^(start|end)(Date|At|Time)?$/.exec(key);
    if (range) {
      params.set('datePreset', 'custom');
      params.set((range[2] ?? range[3]) === 'start' ? 'dateFrom' : 'dateTo', value);
      continue;
    }
    const param = DASHBOARD_FILTER_PARAMS[page][key];
    if (param) params.append(param, value);
  }
  const search = params.toString();
  return search ? `?${search}` : '';
}

/** Adds `dashboardUrl` to every row that names a trace (and a span), so each can be cited. */
function linkRows(value: unknown, dashboard: string): unknown {
  if (Array.isArray(value)) return value.map(row => linkRows(row, dashboard));
  if (!value || typeof value !== 'object') return value;
  const row = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(row)) out[key] = Array.isArray(child) ? linkRows(child, dashboard) : child;
  if (typeof row['traceId'] === 'string') {
    const span = typeof row['spanId'] === 'string' ? `?spanId=${encodeURIComponent(row['spanId'])}` : '';
    out['dashboardUrl'] = `${dashboard}/traces/${encodeURIComponent(row['traceId'])}${span}`;
  }
  return out;
}

/** A read's result plus the dashboard links to what it read; the result alone without a dashboard. */
function withLinks(client: AlertReadClient, incidentId: string, page: string, result: unknown) {
  const dashboard = client.dashboardUrl(incidentId);
  if (!dashboard) return result;
  return { dashboardUrl: `${dashboard}${page}`, result: linkRows(result, dashboard) };
}

const incidentId = z.string().min(1).describe('The Platform incident id from the alert card');
const filters = z
  .record(z.string(), z.string())
  .optional()
  .describe('Flat filters, e.g. { "status": "error", "perPage": "20", "startedAt.start": "<iso>" }');

/** Read-only tools over one Platform org's alert incidents. Nothing here can write or delete. */
export function buildAlertReadTools(client: AlertReadClient, organizationId: string) {
  return {
    alert_list_traces: createTool({
      id: 'alert_list_traces',
      description:
        "List traces in the alert incident's project (read-only, region-bound). Returns dashboardUrl links to cite as evidence.",
      inputSchema: z.object({ incidentId, filters }),
      execute: async input =>
        withLinks(
          client,
          input.incidentId,
          `/traces${dashboardSearch('traces', input.filters)}`,
          await client.read(organizationId, input.incidentId, { method: 'GET', path: '/traces', query: input.filters }),
        ),
    }),
    alert_get_trace: createTool({
      id: 'alert_get_trace',
      description: 'Fetch one trace with its spans for an alert incident (read-only).',
      inputSchema: z.object({ incidentId, traceId: z.string().min(1) }),
      execute: async input =>
        withLinks(
          client,
          input.incidentId,
          `/traces/${encodeURIComponent(input.traceId)}`,
          await client.read(organizationId, input.incidentId, {
            method: 'GET',
            path: `/traces/${encodeURIComponent(input.traceId)}`,
          }),
        ),
    }),
    alert_list_logs: createTool({
      id: 'alert_list_logs',
      description: "List logs in the alert incident's project (read-only).",
      inputSchema: z.object({ incidentId, filters }),
      execute: async input =>
        withLinks(
          client,
          input.incidentId,
          `/logs${dashboardSearch('logs', input.filters)}`,
          await client.read(organizationId, input.incidentId, { method: 'GET', path: '/logs', query: input.filters }),
        ),
    }),
    alert_metric_aggregate: createTool({
      id: 'alert_metric_aggregate',
      description: 'Aggregate a metric for the alert incident (POST /metrics/aggregate body, read-only).',
      inputSchema: z.object({ incidentId, body: z.record(z.string(), z.unknown()) }),
      execute: async input =>
        withLinks(
          client,
          input.incidentId,
          '/metrics',
          await client.read(organizationId, input.incidentId, {
            method: 'POST',
            path: '/metrics/aggregate',
            body: input.body,
          }),
        ),
    }),
  };
}
