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

/** Marks a client that already has our error guard attached for the current checkout. */
const GUARD_ATTACHED = Symbol.for('@mastra/pg.clientErrorGuardAttached');

/**
 * Attach an `'error'` listener to a checked-out {@link PoolClient} for the
 * lifetime of the checkout, returning a function that detaches it.
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
 * Pool-level `'error'` handlers do NOT cover this case. This handler does.
 *
 * The guard's lifetime is scoped to the checkout: `pg-pool` assigns a fresh
 * `release` to the client on every checkout, so we wrap *that* `release` and
 * detach when it is called. On detach we remove our listener and restore the
 * original `release`, so:
 *   - the guard never runs alongside pg-pool's restored idle listener after
 *     release (no double handling),
 *   - a reused pooled client is re-guarded on its next checkout with that
 *     checkout's logger (no stale logger), and
 *   - clients from user-provided/shared pools are left exactly as they were.
 * The original `release` is still invoked with the caller's arguments (e.g.
 * `release(err)`), preserving normal and double-release semantics.
 */
export function attachClientErrorHandler(client: PoolClient, logger?: ClientErrorLogger): () => void {
  // A real pg PoolClient is an EventEmitter, but guard against clients that
  // aren't (e.g. test doubles) so the guard never introduces a new failure.
  // Require both add and remove so detach() can never leave a dangling listener.
  if (typeof client.on !== 'function' || typeof client.removeListener !== 'function') {
    return () => {};
  }

  const guarded = client as PoolClient & { [GUARD_ATTACHED]?: boolean };
  // Already guarded for the current checkout — don't stack a second listener.
  if (guarded[GUARD_ATTACHED]) {
    return () => {};
  }

  const onError = (err: unknown) => {
    try {
      const meta = { err: err instanceof Error ? err.message : String(err) };
      if (logger?.warn) {
        logger.warn(CHECKED_OUT_CLIENT_ERROR_MESSAGE, meta);
      } else {
        console.warn(CHECKED_OUT_CLIENT_ERROR_MESSAGE, meta);
      }
    } catch {
      // An error handler must never rethrow, even if logging or error
      // stringification fails, or the original client error could still crash.
    }
  };

  guarded[GUARD_ATTACHED] = true;
  client.on('error', onError);

  const originalRelease = typeof client.release === 'function' ? client.release : undefined;

  let detached = false;
  const detach = () => {
    if (detached) return;
    detached = true;
    client.removeListener('error', onError);
    guarded[GUARD_ATTACHED] = false;
    if (originalRelease) {
      client.release = originalRelease;
    }
  };

  // Wrap the checkout-specific release so the guard detaches exactly when this
  // checkout ends, then delegates to pg-pool's release (which discards a dead
  // client and re-attaches its own idle listener). Existing
  // `finally { client.release(err?) }` call sites keep working unchanged.
  if (originalRelease) {
    client.release = function (this: PoolClient, ...args: Parameters<PoolClient['release']>) {
      detach();
      return (originalRelease as (...a: unknown[]) => unknown).apply(this, args);
    } as PoolClient['release'];
  }

  return detach;
}

/**
 * Acquire a client from `pool` with a client-level `'error'` handler attached
 * for the lifetime of the checkout (see {@link attachClientErrorHandler}). The
 * guard detaches itself on `client.release()`, so existing
 * `finally { client.release() }` code keeps working unchanged.
 */
export async function connectWithClientErrorHandler(pool: Pool, logger?: ClientErrorLogger): Promise<PoolClient> {
  const client = await pool.connect();
  attachClientErrorHandler(client, logger);
  return client;
}
