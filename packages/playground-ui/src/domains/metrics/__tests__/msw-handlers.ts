import { delay, http, HttpResponse } from 'msw';
import type { JsonBodyType } from 'msw';

import { TEST_BASE_URL } from '@/test/render';

export type MetricsEndpoint = 'aggregate' | 'breakdown' | 'timeseries' | 'percentiles';

const metricsUrl = (endpoint: MetricsEndpoint) => `${TEST_BASE_URL}/api/observability/metrics/${endpoint}`;

/** Responds to every request on the endpoint with the given body. */
export const metricsSuccess = (endpoint: MetricsEndpoint, body: JsonBodyType) =>
  http.post(metricsUrl(endpoint), () => HttpResponse.json(body));

/** Responds with an error status (500 by default, 403 for permission errors). */
export const metricsError = (endpoint: MetricsEndpoint, status: 500 | 403 = 500) =>
  http.post(metricsUrl(endpoint), () => HttpResponse.json({ error: 'boom' }, { status }));

/** Never resolves, so the card stays in its loading state. */
export const metricsPending = (endpoint: MetricsEndpoint) =>
  http.post(metricsUrl(endpoint), async () => {
    await delay('infinite');
    return HttpResponse.json({});
  });

/** Records each request body sent to the endpoint and responds with the given body. */
export const metricsRecorder = (endpoint: MetricsEndpoint, body: JsonBodyType) => {
  const requests: unknown[] = [];
  const handler = http.post(metricsUrl(endpoint), async ({ request }) => {
    requests.push(await request.json());
    return HttpResponse.json(body);
  });
  return { handler, requests };
};

/** The parts of a metrics request body that identify which hook sent it. */
export type MetricsRequest = {
  name: string[];
  groupBy: string[];
  distinctColumn: string | undefined;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function parseMetricsRequest(raw: unknown): MetricsRequest {
  if (typeof raw !== 'object' || raw === null) return { name: [], groupBy: [], distinctColumn: undefined };
  const name = 'name' in raw ? stringList(raw.name) : [];
  const groupBy = 'groupBy' in raw ? stringList(raw.groupBy) : [];
  const distinctColumn =
    'distinctColumn' in raw && typeof raw.distinctColumn === 'string' ? raw.distinctColumn : undefined;
  return { name, groupBy, distinctColumn };
}

/** Picks the response from the request body, for endpoints shared by several hooks or parallel calls. */
export const metricsResolve = (endpoint: MetricsEndpoint, resolve: (request: MetricsRequest) => JsonBodyType) =>
  http.post(metricsUrl(endpoint), async ({ request }) =>
    HttpResponse.json(resolve(parseMetricsRequest(await request.json()))),
  );
