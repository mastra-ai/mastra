/**
 * Lightweight phase timing for factory boot and hot request paths.
 *
 * Deliberately not a metrics framework: structured stderr lines that can be
 * grepped (`[factory:timing]`) and diffed across runs to localize slow boot
 * phases and slow per-request dependencies.
 */

/** Run `fn`, always logging its duration under `phase`. Boot-phase use. */
export async function timedPhase<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    process.stderr.write(`[factory:timing] ${phase} ${Math.round(performance.now() - start)}ms\n`);
  }
}

/**
 * Run `fn`, logging only when it exceeds `thresholdMs`. Request-path use,
 * where per-request logging would be noise but slow outliers must surface.
 */
export async function timedAboveThreshold<T>(phase: string, thresholdMs: number, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const elapsed = performance.now() - start;
    if (elapsed > thresholdMs) {
      process.stderr.write(`[factory:timing] slow ${phase} ${Math.round(elapsed)}ms\n`);
    }
  }
}
