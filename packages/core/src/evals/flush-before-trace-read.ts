import type { Mastra } from '../mastra';

// About as long as the addScore() trace lookup retries (~5.85 s).
const FLUSH_TIMEOUT_MS = 6_000;

/**
 * Exporters buffer spans (the storage exporter waits up to 5 s before it
 * writes), so a trace read right after a run finds nothing. Flush first, but
 * only when there is a stored trace to read. Best-effort and time-limited: a
 * failed or hung flush only means the trace read falls back.
 */
export async function flushBeforeTraceRead(
  mastra: Mastra | undefined,
  traceId: string | null | undefined,
): Promise<void> {
  if (!mastra?.getStorage() || !traceId) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = await Promise.race([
      mastra.observability.flush().then(() => false),
      new Promise<boolean>(resolve => {
        timer = setTimeout(() => resolve(true), FLUSH_TIMEOUT_MS);
      }),
    ]);
    if (timedOut) {
      mastra
        .getLogger()
        ?.warn(`Observability flush did not finish in ${FLUSH_TIMEOUT_MS} ms; reading the trace anyway.`);
    }
  } catch (error) {
    mastra.getLogger()?.warn('Failed to flush observability before reading the trace:', error);
  } finally {
    clearTimeout(timer);
  }
}
