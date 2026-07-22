/**
 * Browser-side helper for the Factory queue-health threshold endpoint.
 *
 * The thresholds are server-side, project-scoped config (seconds) read by the
 * Overview page to bucket work-item ages; the chart's aggregation itself runs
 * client-side (its active-work input is browser-only). Mirrors the thin
 * `services/metrics.ts` fetcher shape.
 */

import type { QueueHealthConfig } from '@mastra/factory/storage/domains/queue-health/base';

/** Fetch the org's age-threshold config for a project (defaults when unset). */
export async function fetchQueueHealthThresholds(
  baseUrl: string,
  factoryProjectId: string,
): Promise<QueueHealthConfig> {
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/health/thresholds`, {
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
  // The route serves the ordered boundary seconds (`{ thresholds: number[] }`).
  const data = (await res.json()) as { thresholds: number[] };
  return { thresholdsSeconds: data.thresholds };
}
