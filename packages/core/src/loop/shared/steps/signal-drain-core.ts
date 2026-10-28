import type { CreatedAgentSignal } from '../../../agent/signals';
import type { IMastraLogger } from '../../../logger';

export type SignalDrainOutcome = { drained: false } | { drained: true; nextMessageId: string };

/**
 * Shared signal-drain behavior: drain signals
 * queued for the run, seal the in-progress response message and rotate to a
 * fresh one, append each signal to the transcript, and emit it to the
 * client-facing stream. All four drain sites (the signal-drain step and the
 * inline continuation-predicate drain, on both engines) run this sequence;
 * callers own the seal-id choice and how the outcome projects back onto
 * their state shape.
 *
 * Dependencies are lazy on purpose: the durable engine materializes its
 * `MessageList` from serialized state only when `rotateResponseMessageId` /
 * `addSignal` are first invoked, preserving its drain-first ordering.
 *
 * Error policy is per-engine, matching each engine's shipped pre-unification
 * behavior:
 *
 * - `'fatal'` (default engine): a drain failure rethrows and fails the run.
 *   The released default loop had no catch around either drain site (the
 *   signal-drain step or the inline predicate drain), so a failure surfaced
 *   exactly once to the caller. Swallowing it here would silently drop
 *   signals on an engine with no redelivery to retry the drain.
 * - `'best-effort'` (durable engine): a failure is logged and reported as
 *   `{ drained: false }` rather than failing the run. Durable redelivery
 *   re-runs the drain site, and the drain call is inside the guard, so
 *   signals remain queued for the next site when the drain itself throws.
 *   A failure after draining (rotate/append/emit) cannot roll back
 *   transcript mutations already applied; the next drain site simply sees
 *   an empty queue.
 */
export async function drainSignalsToTranscript(deps: {
  drainPendingSignals: ((scope?: 'pending' | 'pre-run') => CreatedAgentSignal[]) | undefined;
  rotateResponseMessageId: (sealMessageId?: string) => string;
  addSignal: (signal: CreatedAgentSignal) => { toDataPart(): unknown };
  emitChunk: (chunk: unknown) => void | Promise<void>;
  /** Message id to seal; defaults to the transcript's current response message. */
  sealMessageId?: string;
  /**
   * How drain failures surface: `'fatal'` rethrows (default engine's released
   * contract), `'best-effort'` logs and returns `{ drained: false }` (durable
   * engine — redelivery re-runs the drain site).
   */
  errorPolicy: 'fatal' | 'best-effort';
  logger?: IMastraLogger;
}): Promise<SignalDrainOutcome> {
  try {
    const pendingSignals = deps.drainPendingSignals?.() ?? [];
    if (pendingSignals.length === 0) {
      return { drained: false };
    }

    const nextMessageId = deps.rotateResponseMessageId(deps.sealMessageId);
    for (const pendingSignal of pendingSignals) {
      const signalForTranscript = deps.addSignal(pendingSignal);
      await deps.emitChunk(signalForTranscript.toDataPart());
    }
    return { drained: true, nextMessageId };
  } catch (error) {
    if (deps.errorPolicy === 'fatal') {
      throw error;
    }
    deps.logger?.warn('Signal drain failed; continuing without drained signals', { error });
    return { drained: false };
  }
}
