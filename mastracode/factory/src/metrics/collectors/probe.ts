import type { MetricSink } from '../metrics.js';

export class ProbeTimeout extends Error {}

export async function withTimeout<T>(timeoutMs: number, run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProbeTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export type ProbeResult = { ok: true } | { ok: false; error: unknown };

/**
 * Components whose round trip is its own signal. The stats probes run over the same pool or
 * Redis client, so their durations would repeat these; only their failures are sent.
 */
const TIMED_COMPONENTS = new Set(['db_store', 'db_vector', 'redis']);

export type Probe = (
  sink: MetricSink,
  component: string,
  timeoutMs: number,
  run: () => Promise<unknown>,
) => Promise<ProbeResult>;

/**
 * A probe for one collector. It times `run` and emits `mastra_factory_probe_duration_ms{component}`
 * on success (only for the components in {@link TIMED_COMPONENTS}), or
 * `mastra_factory_probe_failures_total{component,reason}` when it throws or exceeds
 * `timeoutMs`. The timeout only stops waiting, it can't cancel the call, so a component whose call
 * hasn't settled isn't checked again until it returns: a hung dependency holds at most one call
 * (and one pooled connection) per component. Each collector has its own guard.
 */
export function createProbe(): Probe {
  const stillRunning = new Set<string>();
  return async (sink, component, timeoutMs, run) => {
    const timed = TIMED_COMPONENTS.has(component);
    if (stillRunning.has(component)) {
      sink.emit('mastra_factory_probe_failures_total', 1, { component, reason: 'timeout' });
      return { ok: false, error: new ProbeTimeout() };
    }
    const start = performance.now();
    stillRunning.add(component);
    // A synchronous throw becomes a rejection, so the component is always released.
    const call = Promise.resolve()
      .then(run)
      .finally(() => stillRunning.delete(component));
    try {
      await withTimeout(timeoutMs, () => call);
      if (timed) sink.emit('mastra_factory_probe_duration_ms', performance.now() - start, { component });
      return { ok: true };
    } catch (error) {
      sink.emit('mastra_factory_probe_failures_total', 1, {
        component,
        reason: error instanceof ProbeTimeout ? 'timeout' : 'error',
      });
      return { ok: false, error };
    }
  };
}

export function errorText(error: unknown): string {
  if (error instanceof ProbeTimeout) return 'timeout';
  return error instanceof Error ? error.message : String(error);
}
