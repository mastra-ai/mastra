/**
 * Harness v1 — replay-aware event stream bridge.
 *
 * `bridgeReplayAndLive(harness, opts)` returns an `AsyncIterable<HarnessEvent>`
 * that:
 *
 *   1. Subscribes to the live harness emitter FIRST so no events emitted
 *      after this call are lost, even if the replay phase is slow.
 *   2. (Optionally) reads stored events from `opts.sinceCursor` to the
 *      current head and yields them in order.
 *   3. Switches to the buffered live stream once replay is caught up,
 *      deduping any overlap by `sequence`.
 *
 * The bridge composes the existing public surfaces — it does not access
 * private fields of `Harness` or `Session`. It is the production entry
 * point for SSE / A2A `tasks/resubscribe` / headless-worker consumers
 * that need durable resume semantics.
 *
 * Errors are typed (`harness.event_replay_*` codes) so transport
 * adapters can map them to wire shapes without inspecting the message.
 */

import type { HarnessEvent } from './events';
import { parseHarnessEventId } from './events';
import type { Harness } from './harness';
import { projectHarnessEventForPublicView } from './public-view';
import type { PublicViewProjectionOptions } from './public-view';

export interface BridgeReplayCursor {
  /** Stored event epoch. Use the value from `Harness.getSessionEventReplayState`. */
  epoch: string;
  /**
   * Exclusive lower bound. Sequences start at 0. Pass `-1` to replay
   * from the first event in the epoch.
   */
  afterSequence: number;
}

export interface BridgeReplayOptions {
  sessionId: string;
  resourceId: string;
  /**
   * Where to start.
   * - omitted: skip replay, start from live only.
   * - `'beginning'`: replay every stored event from the current epoch.
   * - cursor object: resume after `cursor.afterSequence` in `cursor.epoch`.
   */
  sinceCursor?: BridgeReplayCursor | 'beginning';
  /**
   * Aborts the iterable. The in-flight `next()` rejects with
   * `HarnessEventReplayAbortedError`. Idempotent: calling abort after
   * iteration ends is a no-op.
   */
  signal?: AbortSignal;
  /**
   * Max events to buffer from the live stream during replay catch-up.
   * Default 1000. If the live stream exceeds this while we are still
   * paging stored events, the iterable throws
   * `HarnessEventReplayBufferOverflowError`.
   */
  maxBufferedLive?: number;
  /** Replay page size. Default 256. */
  replayPageSize?: number;
  /**
   * Project every event through `projectHarnessEventForPublicView`
   * before yielding. Use for SSE / A2A / channel-webhook consumers
   * that should not see raw tool args/results, internal observational-
   * memory text, thread titles, etc. In-process callers should leave
   * this false (default) — they need full fidelity.
   *
   * `publicViewOptions` is forwarded to the projector so a transport
   * adapter can tighten / loosen the redaction policy per call.
   */
  publicView?: boolean;
  publicViewOptions?: PublicViewProjectionOptions;
}

/**
 * Cursor `afterSequence` is older than the oldest stored sequence. The
 * gap is not recoverable — caller should reset to `'beginning'` or
 * accept the data loss explicitly.
 */
export class HarnessEventReplayStaleCursorError extends Error {
  readonly name = 'HarnessEventReplayStaleCursorError';
  readonly code = 'harness.event_replay_stale_cursor';
  constructor(
    public readonly cursorAfterSequence: number,
    public readonly oldestSequence: number,
    public readonly newestSequence: number,
  ) {
    super(`cursor afterSequence=${cursorAfterSequence} is older than the oldest stored sequence ${oldestSequence}`);
  }
}

/**
 * Cursor epoch does not match the current stored epoch. The emitter was
 * regenerated since the cursor was issued (most commonly a session
 * rehydration race or a hard-delete + recreate cycle). Caller should
 * reset to `'beginning'`.
 */
export class HarnessEventReplayEpochMismatchError extends Error {
  readonly name = 'HarnessEventReplayEpochMismatchError';
  readonly code = 'harness.event_replay_epoch_mismatch';
  constructor(
    public readonly cursorEpoch: string,
    public readonly currentEpoch: string,
  ) {
    super(`cursor epoch "${cursorEpoch}" does not match current epoch "${currentEpoch}"`);
  }
}

/**
 * Cursor `afterSequence` is ahead of the newest stored sequence. The
 * caller is referencing an event that has not been recorded yet —
 * typically a stale read against a different replica.
 */
export class HarnessEventReplayFutureCursorError extends Error {
  readonly name = 'HarnessEventReplayFutureCursorError';
  readonly code = 'harness.event_replay_future_cursor';
  constructor(
    public readonly cursorAfterSequence: number,
    public readonly newestSequence: number,
  ) {
    super(`cursor afterSequence=${cursorAfterSequence} is ahead of newest stored sequence ${newestSequence}`);
  }
}

/**
 * The live-event buffer overflowed during replay catch-up. Caller is
 * consuming the bridge slower than events are being produced. The
 * caller should either raise `maxBufferedLive` or accept dropped data
 * by restarting from a fresher cursor.
 */
export class HarnessEventReplayBufferOverflowError extends Error {
  readonly name = 'HarnessEventReplayBufferOverflowError';
  readonly code = 'harness.event_replay_buffer_overflow';
  constructor(public readonly capacity: number) {
    super(`live event buffer overflowed during replay catch-up (capacity=${capacity})`);
  }
}

/**
 * The caller aborted the iterable via `opts.signal`.
 */
export class HarnessEventReplayAbortedError extends Error {
  readonly name = 'HarnessEventReplayAbortedError';
  readonly code = 'harness.event_replay_aborted';
  constructor() {
    super('replay bridge aborted by signal');
  }
}

/**
 * Bridge stored event replay with the live emitter stream.
 *
 * The returned iterable is **single-shot** — invoking
 * `[Symbol.asyncIterator]()` more than once yields no further events.
 *
 * Cancellation contract:
 * - Preferred: pass `opts.signal` from an `AbortController`. The
 *   in-flight `next()` rejects with `HarnessEventReplayAbortedError`
 *   and the generator's finally unsubscribes immediately.
 * - `for await ... break` also cleans up, but only after the next
 *   yield point. A bridge that has produced no events yet cannot be
 *   canceled by break alone — use the signal.
 * - Any exception thrown by the consumer body propagates through the
 *   generator's finally, which always unsubscribes from the harness
 *   emitter.
 */
export async function* bridgeReplayAndLive(
  harness: Harness,
  opts: BridgeReplayOptions,
): AsyncGenerator<HarnessEvent, void, unknown> {
  const maxBufferedLive = opts.maxBufferedLive ?? 1000;
  const pageSize = opts.replayPageSize ?? 256;
  // Sentinel below -1 so a `lastDeliveredSequence < 0` comparison
  // against sequence 0 (the first event) cannot accidentally dedupe it.
  let lastDeliveredSequence = -2;
  const project = (event: HarnessEvent): HarnessEvent | null =>
    opts.publicView ? projectHarnessEventForPublicView(event, opts.publicViewOptions) : event;

  const liveBuffer: HarnessEvent[] = [];
  let bufferOverflow = false;
  let aborted = false;
  const waiters: Array<() => void> = [];

  const wake = () => {
    while (waiters.length > 0) {
      const resolve = waiters.shift()!;
      resolve();
    }
  };

  const onLive = (event: HarnessEvent): void => {
    if (event.sessionId !== opts.sessionId) return;
    if (liveBuffer.length >= maxBufferedLive) {
      bufferOverflow = true;
      wake();
      return;
    }
    liveBuffer.push(event);
    wake();
  };

  const unsubscribe = harness.subscribe(onLive);

  const abortHandler = (): void => {
    aborted = true;
    wake();
  };
  let abortHandlerAttached = false;
  if (opts.signal?.aborted) {
    aborted = true;
  } else if (opts.signal !== undefined) {
    opts.signal.addEventListener('abort', abortHandler);
    abortHandlerAttached = true;
  }

  const checkOverflow = (): void => {
    if (bufferOverflow) throw new HarnessEventReplayBufferOverflowError(maxBufferedLive);
  };
  const checkAbort = (): void => {
    if (aborted) throw new HarnessEventReplayAbortedError();
  };

  try {
    // -----------------------------------------------------------------
    // Replay phase — only when a cursor was supplied. Skipped sessions
    // (no recorded events at all → state === null) fall through to
    // live-only.
    // -----------------------------------------------------------------
    if (opts.sinceCursor !== undefined) {
      const state = await harness.getSessionEventReplayState({
        sessionId: opts.sessionId,
        resourceId: opts.resourceId,
      });
      checkAbort();
      checkOverflow();

      if (state !== null) {
        let cursorEpoch: string;
        let cursorAfterSequence: number;
        if (opts.sinceCursor === 'beginning') {
          cursorEpoch = state.epoch;
          cursorAfterSequence = -1;
        } else {
          cursorEpoch = opts.sinceCursor.epoch;
          cursorAfterSequence = opts.sinceCursor.afterSequence;
        }

        if (cursorEpoch !== state.epoch) {
          throw new HarnessEventReplayEpochMismatchError(cursorEpoch, state.epoch);
        }
        if (cursorAfterSequence > state.newestSequence) {
          throw new HarnessEventReplayFutureCursorError(cursorAfterSequence, state.newestSequence);
        }
        // `afterSequence` is exclusive. `oldestSequence - 1` is the
        // minimum legal cursor (caller wants every stored event).
        // Anything below that is a gap the storage layer cannot
        // service.
        if (cursorAfterSequence < state.oldestSequence - 1) {
          throw new HarnessEventReplayStaleCursorError(cursorAfterSequence, state.oldestSequence, state.newestSequence);
        }

        let nextAfter = cursorAfterSequence;
        while (nextAfter < state.newestSequence) {
          checkAbort();
          checkOverflow();
          const rows = await harness.listSessionEventsAfter({
            sessionId: opts.sessionId,
            resourceId: opts.resourceId,
            epoch: cursorEpoch,
            afterSequence: nextAfter,
            limit: pageSize,
          });
          if (rows.length === 0) break;
          for (const row of rows) {
            // Re-check on every iteration: the generator suspends at
            // `yield`, so overflow / abort can race in between rows.
            checkAbort();
            checkOverflow();
            // Storage stores events as `JsonValue` (post-serialization
            // snapshot from `snapshotHarnessEventForJson`). The shape
            // matches `HarnessEvent` because that's exactly what was
            // serialized; downstream consumers treat it as such.
            const projected = project(row.event as unknown as HarnessEvent);
            // The projector can return null to drop an event from the
            // public stream — we still advance `lastDeliveredSequence`
            // so the live phase doesn't re-deliver it via the overlap
            // dedupe.
            if (projected !== null) yield projected;
            lastDeliveredSequence = row.sequence;
          }
          nextAfter = rows[rows.length - 1]!.sequence;
        }
      }
    }

    // -----------------------------------------------------------------
    // Live phase — drain the buffer with sequence-based dedupe, then
    // wait for new events. The loop only exits on abort, overflow, or
    // an external `return()` / `throw()` from the consumer.
    // -----------------------------------------------------------------
    for (;;) {
      checkAbort();
      checkOverflow();
      while (liveBuffer.length > 0) {
        const event = liveBuffer.shift()!;
        let sequence: number;
        try {
          sequence = parseHarnessEventId(event.id).sequence;
        } catch {
          // Unparseable id should never happen for events that came
          // from the same emitter, but if it does, deliver (projected
          // if publicView) without dedupe so the consumer can react.
          const projected = project(event);
          if (projected !== null) yield projected;
          continue;
        }
        if (sequence <= lastDeliveredSequence) continue; // overlap with replay tail
        const projected = project(event);
        if (projected !== null) yield projected;
        lastDeliveredSequence = sequence;
        checkAbort();
        checkOverflow();
      }
      // Bounded park so consumer-side `iter.return()` cannot stall the
      // generator's finally cleanup indefinitely. Without this poll the
      // `await new Promise(...)` would only resolve on live/abort/
      // overflow — so a consumer that exits via `return()` (e.g. a
      // `for await` `break` after a `yield`, then external clean-up
      // without aborting) would leak the harness subscription. The
      // bounded interval guarantees the loop reaches `checkAbort()`
      // (or naturally exits via the finally on return) within ~250ms.
      await new Promise<void>(resolve => {
        let resolved = false;
        const wakeOnce = (): void => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          const i = waiters.indexOf(wakeOnce);
          if (i !== -1) waiters.splice(i, 1);
          resolve();
        };
        const timer = setTimeout(wakeOnce, 250);
        waiters.push(wakeOnce);
      });
    }
  } finally {
    unsubscribe();
    if (abortHandlerAttached) {
      // Always detach if we attached, regardless of whether the signal
      // has fired. addEventListener without `{once:true}` keeps the
      // listener registered after the event; relying on
      // `!signal.aborted` would skip cleanup on the very path that
      // most needs it (the abort path).
      opts.signal!.removeEventListener('abort', abortHandler);
    }
  }
}
