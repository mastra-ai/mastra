// HTTP jobs share cancellation with nested workflows and all model phases by intake run ID.
const controllers = new Map<string, AbortController>();

export function beginExecution(runId: string) {
  if (controllers.has(runId)) throw new Error('RUN_BUSY');
  const controller = new AbortController();
  controllers.set(runId, controller);
  return controller;
}
export function endExecution(runId: string) {
  controllers.delete(runId);
}
export const executionSignal = (runId: string) => controllers.get(runId)?.signal;
export const checkCancellation = (runId: string) => executionSignal(runId)?.throwIfAborted();

export async function runCancellable<T>(runId: string, run: { cancel(): Promise<void> }, work: () => Promise<T>) {
  const signal = executionSignal(runId);
  signal?.throwIfAborted();
  let cancellation: Promise<void> | undefined;
  const cancel = () => {
    cancellation = run.cancel();
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const result = await work();
    signal?.throwIfAborted();
    return result;
  } finally {
    signal?.removeEventListener('abort', cancel);
    await cancellation;
  }
}
