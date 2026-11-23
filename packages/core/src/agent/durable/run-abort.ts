/**
 * The abort controller a durable run segment (stream, resume, recover,
 * generate) installs on its run registry entry. The caller's signal, when
 * given, is forwarded onto it so either source can cancel the run.
 */
export interface RunAbortController {
  readonly controller: AbortController;
  /** Stop forwarding the caller's signal. Safe to call more than once. */
  detach(): void;
}

export interface CreateRunAbortControllerOptions {
  /**
   * Called after the caller's signal has been forwarded onto the controller,
   * e.g. to also publish an abort request to a step worker in another process.
   */
  onExternalAbort?: () => void;
}

export function createRunAbortController(
  externalSignal: AbortSignal | undefined,
  { onExternalAbort }: CreateRunAbortControllerOptions = {},
): RunAbortController {
  const controller = new AbortController();
  if (!externalSignal) return { controller, detach: () => {} };

  const forward = () => {
    controller.abort(externalSignal.reason);
    onExternalAbort?.();
  };
  if (externalSignal.aborted) {
    forward();
    return { controller, detach: () => {} };
  }
  externalSignal.addEventListener('abort', forward, { once: true });
  return { controller, detach: () => externalSignal.removeEventListener('abort', forward) };
}
