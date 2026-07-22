/**
 * Browser-side helper for the Factory metrics endpoint.
 *
 * Mirrors the server's `FactoryMetrics` response shape (computed in
 * `src/web/factory/metrics.ts`) — flow metrics aggregated over the org's
 * work items for one project.
 */

export interface FactoryMetrics {
  windowDays: number;
  /** Items reaching `done` per UTC day, gap-filled across the window. */
  throughput: { date: string; count: number }[];
  /** Card creation → `done` duration for items completed in the window. */
  cycleTime: { medianMs: number | null; p90Ms: number | null; samples: number };
  /** Median time spent per stage, over visits that ended inside the window. */
  stageDurations: { stage: string; medianMs: number; samples: number }[];
  /** Current cards per stage (window-independent). */
  wip: { stage: string; count: number }[];
  /** Distinct in-flight cards (at least one non-terminal stage). */
  wipTotal: number;
  /** Oldest in-flight cards by time in their current stage. */
  agingWip: { id: string; title: string; stage: string; enteredAt: string; url: string | null }[];
  /** Cards created in the window, by source. */
  sourceMix: { source: string; count: number }[];
  /** Stage moves in the window: human-performed vs total. */
  transitions: { human: number; total: number };
  /** Per-stage automation over completed visits that exited in the window. */
  stageAutomation: {
    stage: string;
    /** Completed visits (entered+exited) to this stage that exited in the window. */
    exits: number;
    /** Of those: clean automated passes (first visit, automation-entered and -exited). */
    automated: number;
    /**
     * Outcomes of the automated passes' items, mutually exclusive. Reflects
     * each item's state *now*, so a fixed window's split shifts as in-flight
     * items land (e.g. an `inFlight` pass becomes `done` on a later query).
     */
    outcomes: { done: number; canceled: number; reworked: number; inFlight: number };
  }[];
}

/** Fetch the org's aggregated flow metrics for a Factory project. */
export async function fetchFactoryMetrics(
  baseUrl: string,
  factoryProjectId: string,
  days: number,
): Promise<FactoryMetrics> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/metrics?days=${days}`,
    { headers: { Accept: 'application/json' }, credentials: 'include' },
  );
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
