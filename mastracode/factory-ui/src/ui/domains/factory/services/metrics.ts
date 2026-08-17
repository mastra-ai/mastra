/**
 * Browser-side helper for the Factory metrics endpoint.
 *
 * The response shape is the server's own `FactoryMetrics` — re-exported rather
 * than restated so the two can never drift.
 */

import type { FactoryMetrics } from '@mastra/factory/storage/domains/work-items/metrics';

import { requestJson } from './request';

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
  const data = await requestJson<{ metrics: FactoryMetrics }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/metrics?${query}`,
  );
  return data.metrics;
}
