/** Largest delay `setTimeout` honors; anything above is silently clamped to 1 ms by Node. */
export const MAX_DRAIN_TIMEOUT_MS = 2_147_483_647;

/**
 * Validates a drain timeout at a public boundary (`Mastra.shutdown()`,
 * `Mastra.stopWorkers()`, `PullTransport`). Returns the value so callers can
 * inline it.
 */
export function assertDrainTimeout(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > MAX_DRAIN_TIMEOUT_MS) {
    throw new RangeError(
      `${label} drainTimeout must be a finite number of milliseconds between 0 and ${MAX_DRAIN_TIMEOUT_MS}`,
    );
  }
  return value;
}
