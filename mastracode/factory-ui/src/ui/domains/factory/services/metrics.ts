/**
 * Browser-side helper for the Factory metrics endpoint.
 *
 * The response shape is the server's own `FactoryMetrics` — re-exported rather
 * than restated so the two can never drift.
 */

import type { FactoryMetrics } from '@mastra/factory/storage/domains/work-items/metrics';

export type { FactoryMetrics };

/** Inclusive UTC calendar-date bounds (`yyyy-MM-dd`) for a metrics request. */
export interface FactoryMetricsRange {
  from: string;
  to: string;
}

/** Fetch the org's aggregated flow metrics for a Factory project over a window. */
export async function fetchFactoryMetrics(
  baseUrl: string,
  factoryProjectId: string,
  range: FactoryMetricsRange,
): Promise<FactoryMetrics> {
  const query = new URLSearchParams({ from: range.from, to: range.to });
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/metrics?${query}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as { metrics: FactoryMetrics };
  return data.metrics;
}
