import type { Pool, PoolClient } from 'pg';

/**
 * Minimal logger surface. Matches the `this.logger?.warn?.(...)` shape used by
 * MastraBase-derived stores; callers without a logger fall back to console.
 */
export interface ClientErrorLogger {
  warn?: (message: string, meta?: Record<string, unknown>) => void;
}

const CHECKED_OUT_CLIENT_ERROR_MESSAGE =
  'checked-out pg client error (client is discarded and a recoverable error is surfaced instead of crashing the host process)';

/** Marks a client that already has our error guard attached, to stay idempotent. */
const GUARD_ATTACHED = Symbol.for('@mastra/pg.clientErrorGuardAttached');

/**
 * Attach an `'error'` listener to a checked-out {@link PoolClient}, returning a
 * function that detaches it.
 *
 * node-postgres emits `'error'` on the **Client** (not the Pool) when a
 * checked-out client's backend connection dies while it is idle between
 * queries — e.g. an idle-TCP kill by a pooler/NAT, a backend restart, or a
 * `pg_terminate_backend`. Crucially, `pg-pool` *removes* its own pool-level
 * idle `'error'` listener from the client on checkout (`_acquireClient`) and
 * only re-adds it on release (`_release`), so during the checkout window the
 * client has no `'error'` listener at all. Without one, Node escalates the
 * event to an uncaughtException and crashes the process:
 *
 *   Error: Connection terminated unexpectedly
 *   ... Emitted 'error' event on Client instance ...
 *
 * Pool-level `'error'` handlers do NOT cover this case. This handler does. It
 * is attached at most once per client (pooled clients are reused across
 * checkouts, so a single persistent listener both covers every checkout and
 * avoids leaking a listener per checkout).
 */
export function attachClientErrorHandler(client: PoolClient, logger?: ClientErrorLogger): () => void {
  // A real pg PoolClient is an EventEmitter, but guard against clients that
  // aren't (e.g. test doubles) so the guard never introduces a new failure.
  if (typeof client.on !== 'function') {
    return () => {};
  }

  const guarded = client as PoolClient & { [GUARD_ATTACHED]?: boolean };
  if (guarded[GUARD_ATTACHED]) {
    return () => {};
  }

  const onError = (err: unknown) => {
    const meta = { err: err instanceof Error ? err.message : String(err) };
    if (logger?.warn) {
      logger.warn(CHECKED_OUT_CLIENT_ERROR_MESSAGE, meta);
    } else {
      console.warn(CHECKED_OUT_CLIENT_ERROR_MESSAGE, meta);
    }
  };

  guarded[GUARD_ATTACHED] = true;
  client.on('error', onError);

  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    guarded[GUARD_ATTACHED] = false;
    if (typeof client.removeListener === 'function') {
      client.removeListener('error', onError);
    }
  };
}

/**
 * Acquire a client from `pool` with a client-level `'error'` handler attached
 * (see {@link attachClientErrorHandler}). The handler is idempotent, so callers
 * do not need to detach it before `client.release()`; existing
 * `finally { client.release() }` code keeps working unchanged.
 */
export async function connectWithClientErrorHandler(pool: Pool, logger?: ClientErrorLogger): Promise<PoolClient> {
  const client = await pool.connect();
  attachClientErrorHandler(client, logger);
  return client;
}
