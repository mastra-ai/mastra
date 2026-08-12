/**
 * Browser-side helper for the Factory queue-health threshold endpoint.
 *
 * The thresholds are server-side, project-scoped config (seconds) read by the
 * Overview page's queue-health section to bucket work-item ages; the chart's aggregation itself runs
 * client-side (its active-work input is browser-only). Mirrors the thin
 * `services/metrics.ts` fetcher shape.
 */

import type { QueueHealthConfig } from '@mastra/factory/storage/domains/queue-health/base';

import { requestJson } from './request';

/** Fetch the org's age-threshold config for a project (defaults when unset). */
export async function fetchQueueHealthThresholds(
  baseUrl: string,
  factoryProjectId: string,
): Promise<QueueHealthConfig> {
  // The route serves the ordered boundary seconds (`{ thresholds: number[] }`).
  const data = await requestJson<{ thresholds: number[] }>(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/health/thresholds`,
  );
  return { thresholdsSeconds: data.thresholds };
}
