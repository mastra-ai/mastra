/**
 * Checks registered by the thread runtime for runs that hold a cross-process thread
 * lease. A tool awaits its run's check before it executes, so a run whose lease was
 * taken over stops before it acts beside its successor instead of at its next renewal.
 */
const fences = new Map<string, () => Promise<void>>();

export function setRunLeaseFence(runId: string, fence: () => Promise<void>): void {
  fences.set(runId, fence);
}

/**
 * Another runtime in the process (for example a second Mastra instance) may have registered
 * the same run id since, so a run that ends clears only its own check.
 */
export function clearRunLeaseFence(runId: string, fence: () => Promise<void>): void {
  if (fences.get(runId) === fence) fences.delete(runId);
}

/** Throws when the run no longer holds its thread lease. */
export async function verifyRunLease(runId: string | undefined): Promise<void> {
  if (runId) await fences.get(runId)?.();
}

/**
 * The steps (model requests and tool calls) each run has running now, keyed by an object owned by that one run
 * instance: the abort signal the thread runtime prepared for it, or a durable run's registry entry. Runs that share
 * a run id, agent or thread never share one.
 */
const runningSteps = new WeakMap<object, { count: number; onSettled: Array<() => void> }>();
/** When each run's last step settled, so the moment between one step and the next doesn't read as idle. */
const lastStepSettledAt = new WeakMap<object, number>();

/** Marks a step of the run this object owns as running. Call the returned function once the step has settled. */
export function startRunStep(owner: object | undefined): () => void {
  if (!owner) return () => {};
  const entry = runningSteps.get(owner) ?? { count: 0, onSettled: [] };
  entry.count++;
  runningSteps.set(owner, entry);
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    if (--entry.count > 0) return;
    if (runningSteps.get(owner) === entry) runningSteps.delete(owner);
    lastStepSettledAt.set(owner, Date.now());
    for (const callback of entry.onSettled) callback();
  };
}

/** Calls `callback` once no step of the run this object owns is running: right away when none is. */
export function whenRunStepsSettle(owner: object | undefined, callback: () => void): void {
  const entry = owner ? runningSteps.get(owner) : undefined;
  if (entry) entry.onSettled.push(callback);
  else callback();
}

/**
 * Whether the run this object owns has a step running, or had one settle within the last `withinMs`. A run that was
 * aborted has none worth waiting for, even while a step is still winding down.
 */
export function isRunStepActive(owner: object | undefined, withinMs: number): boolean {
  if (!owner) return false;
  const signal = owner instanceof AbortSignal ? owner : (owner as { abortSignal?: unknown }).abortSignal;
  if (signal instanceof AbortSignal && signal.aborted) return false;
  if (runningSteps.has(owner)) return true;
  const settledAt = lastStepSettledAt.get(owner);
  return settledAt !== undefined && Date.now() - settledAt < withinMs;
}
