import type { HarnessEvent } from '@mastra/core/harness';

/**
 * Serialized gateway OM record shape returned by
 * GET /v1/memory/threads/:threadId/observations/record
 */
interface GatewayOMRecord {
  id: string;
  scope: string;
  threadId: string | null;
  resourceId: string;
  generationCount: number;
  observationTokenCount: number;
  pendingMessageTokens: number;
  isReflecting: boolean;
  isObserving: boolean;
  isBufferingObservation: boolean;
  isBufferingReflection: boolean;
}

/** Default thresholds — gateway doesn't expose them in the record response. */
const DEFAULT_OBSERVATION_THRESHOLD = 30_000;
const DEFAULT_REFLECTION_THRESHOLD = 40_000;

function mapRecordToEvent(record: GatewayOMRecord, threadId: string): HarnessEvent {
  return {
    type: 'om_status',
    windows: {
      active: {
        messages: {
          tokens: record.pendingMessageTokens,
          threshold: DEFAULT_OBSERVATION_THRESHOLD,
        },
        observations: {
          tokens: record.observationTokenCount,
          threshold: DEFAULT_REFLECTION_THRESHOLD,
        },
      },
      buffered: {
        observations: {
          status: record.isBufferingObservation ? 'running' : 'idle',
          chunks: 0,
          messageTokens: 0,
          projectedMessageRemoval: 0,
          observationTokens: 0,
        },
        reflection: {
          status: record.isBufferingReflection ? 'running' : 'idle',
          inputObservationTokens: 0,
          observationTokens: 0,
        },
      },
    },
    recordId: record.id,
    threadId,
    stepNumber: 0,
    generationCount: record.generationCount,
  };
}

async function fetchOMRecord(
  gatewayBaseUrl: string,
  gatewayApiKey: string,
  threadId: string,
  resourceId: string,
): Promise<GatewayOMRecord | null> {
  const url = `${gatewayBaseUrl}/v1/memory/threads/${encodeURIComponent(threadId)}/observations/record?resourceId=${encodeURIComponent(resourceId)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${gatewayApiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { record: GatewayOMRecord | null };
    return body.record;
  } catch {
    return null;
  }
}

/**
 * Creates an OMProgressProvider callback that fetches OM status from the
 * Memory Gateway API and maps it to a HarnessEvent.
 */
export function createGatewayOMProgressProvider(
  gatewayBaseUrl: string,
  gatewayApiKey: string,
): (threadId: string, resourceId: string) => Promise<HarnessEvent | null> {
  // Normalize: strip trailing slashes and /v1 suffix so we can build URLs consistently
  const baseUrl = gatewayBaseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');

  return async (threadId: string, resourceId: string) => {
    const record = await fetchOMRecord(baseUrl, gatewayApiKey, threadId, resourceId);
    if (!record) return null;
    return mapRecordToEvent(record, threadId);
  };
}

export interface GatewayOMPoller {
  /**
   * Schedule decaying polls after a response completes.
   * Each poll calls the provided callback (typically `harness.loadOMProgress()`).
   */
  pollAfterResponse(loadOMProgress: () => void | Promise<void>): void;
  /** Cancel all pending polls (e.g., on thread switch or new message). */
  cancelPending(): void;
}

/**
 * Creates a poller that schedules decaying follow-up calls to reload OM
 * progress after a response completes. Gateway OM processing is async
 * (observation/reflection takes 2-10s), so we poll at increasing intervals
 * to catch both the initial status and the post-observation update.
 */
export function createGatewayOMPoller(): GatewayOMPoller {
  let pendingTimers: ReturnType<typeof setTimeout>[] = [];

  function cancelPending() {
    for (const t of pendingTimers) clearTimeout(t);
    pendingTimers = [];
  }

  function pollAfterResponse(loadOMProgress: () => void | Promise<void>) {
    cancelPending();

    // Decaying schedule: catch initial status (1s, 3s) and post-observation update (7s, 12s, 18s)
    const delays = [1_000, 3_000, 7_000, 12_000, 18_000];

    for (const delay of delays) {
      const timer = setTimeout(() => {
        void loadOMProgress();
      }, delay);
      pendingTimers.push(timer);
    }
  }

  return { pollAfterResponse, cancelPending };
}
