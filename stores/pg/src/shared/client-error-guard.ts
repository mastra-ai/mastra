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

/**
 * Attach an `'error'` listener to a checked-out {@link PoolClient} for the
 * lifetime of its checkout, returning a function that detaches it.
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
 */
export function attachClientErrorHandler(client: PoolClient, logger?: ClientErrorLogger): () => void {
  const onError = (err: unknown) => {
    const meta = { err: err instanceof Error ? err.message : String(err) };
    if (logger?.warn) {
      logger.warn(CHECKED_OUT_CLIENT_ERROR_MESSAGE, meta);
    } else {
      console.warn(CHECKED_OUT_CLIENT_ERROR_MESSAGE, meta);
    }
  };

  client.on('error', onError);

  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    client.removeListener('error', onError);
  };
}

/**
 * Acquire a client from `pool` with a client-level `'error'` handler attached
 * for the duration of the checkout (see {@link attachClientErrorHandler}).
 *
 * The returned client's `release()` is wrapped to detach the handler before
 * releasing, so existing `finally { client.release() }` code keeps working
 * unchanged. pg assigns a fresh `release` on every checkout, so the wrapper
 * never leaks past this checkout.
 */
export async function connectWithClientErrorHandler(pool: Pool, logger?: ClientErrorLogger): Promise<PoolClient> {
  const client = await pool.connect();
  const detach = attachClientErrorHandler(client, logger);

  const release = client.release.bind(client);
  client.release = (err?: Error | boolean) => {
    detach();
    return release(err);
  };

  return client;
}
