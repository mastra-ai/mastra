/**
 * Provider-owned Discord Gateway reconnection loop.
 *
 * Core's `AgentChannels` has a built-in gateway loop, but the provider opts out
 * of it (`gateway: false` on the adapter entry) and runs this one instead,
 * because the core loop has two failure modes that combine into a connect
 * storm — severe enough that Discord's abuse tripwire (>1000 connects in a
 * short window) force-resets the bot token:
 *
 * - `@chat-adapter/discord` **swallows `client.login()` errors**: a session
 *   that fails IDENTIFY (invalid/reset token, the MessageContent privileged
 *   intent not enabled on the app) resolves "cleanly" within milliseconds.
 * - The core loop reconnects **immediately** on a clean session end and keeps
 *   **no abort handle**, so a failing session becomes a zero-delay IDENTIFY
 *   loop that nothing can stop, and every credential rotation leaks another
 *   immortal loop still hammering with the stale token.
 *
 * This loop defends against both: a session that ends before
 * {@link HEALTHY_SESSION_MS} is treated as a failed connect and backed off
 * exponentially; a REST token check distinguishes a revoked token (park the
 * loop until `configure()` delivers new credentials and restarts it) from a
 * transient failure (keep backing off); and the `AbortSignal` lets the
 * provider kill the loop on disconnect, credential rotation, or re-attach.
 * This mirrors how `@mastra/telegram` owns its polling loop (`stopPolling()`
 * on reconfigure/disconnect, capped backoff on errors).
 */

/** How long each Gateway session runs before a scheduled reconnect. */
export const GATEWAY_SESSION_MS = 24 * 60 * 60 * 1000;
/**
 * A session that ends sooner than this is treated as a failed connect. The
 * adapter resolves login failures as if the session ended cleanly, so elapsed
 * time is the only signal that distinguishes "ran fine until the duration
 * elapsed / Discord closed us" from "IDENTIFY was rejected instantly".
 */
export const HEALTHY_SESSION_MS = 60 * 1000;
/** First retry delay after a failed connect; doubles up to {@link MAX_BACKOFF_MS}. */
export const INITIAL_BACKOFF_MS = 5 * 1000;
/** Retry delay ceiling. */
export const MAX_BACKOFF_MS = 15 * 60 * 1000;
/** Pause between healthy sessions — a scheduled rollover, not a failure. */
export const RECONNECT_DELAY_MS = 1000;
/** After this many consecutive failed connects, log a diagnostic hint. */
export const SHORT_SESSION_HINT_THRESHOLD = 3;

/** Outcome of the between-sessions REST token check. */
export type GatewayTokenCheck = 'valid' | 'invalid' | 'unreachable';

export interface GatewayLoopDeps {
  /**
   * Start one Gateway session (`DiscordAdapter.startGatewayListener`). The
   * session's lifetime promise is delivered through `options.waitUntil`; the
   * returned `Response` only reports whether the session could start.
   */
  startSession(
    options: { waitUntil: (promise: Promise<unknown>) => void },
    durationMs: number,
    signal: AbortSignal,
  ): Promise<Response>;
  /**
   * REST check of the bot token (`GET /applications/@me`), consulted after a
   * failed connect. `'invalid'` (401) parks the loop; `'unreachable'` keeps
   * backing off — a Discord outage must not be mistaken for a revoked token.
   */
  checkToken(): Promise<GatewayTokenCheck>;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  /** Session duration override (tests). Defaults to {@link GATEWAY_SESSION_MS}. */
  sessionMs?: number;
}

/**
 * Run Gateway sessions back-to-back until `signal` aborts or the bot token is
 * confirmed revoked. Resolves when the loop stops; never rejects.
 */
export async function runGatewayLoop(deps: GatewayLoopDeps, signal: AbortSignal): Promise<void> {
  const sessionMs = deps.sessionMs ?? GATEWAY_SESSION_MS;
  let backoffMs = INITIAL_BACKOFF_MS;
  let consecutiveFailures = 0;

  while (!signal.aborted) {
    const startedAt = Date.now();
    try {
      let settle!: () => void;
      let fail!: (err: unknown) => void;
      const done = new Promise<void>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      });
      let sessionDelivered = false;
      const response = await deps.startSession(
        {
          waitUntil: promise => {
            sessionDelivered = true;
            void promise.then(
              () => settle(),
              err => fail(err),
            );
          },
        },
        sessionMs,
        signal,
      );
      // The adapter reports pre-session failures (chat not initialized) as a
      // non-2xx Response without ever invoking waitUntil — awaiting `done`
      // there would hang forever.
      if (!response.ok || !sessionDelivered) {
        throw new Error(`Gateway session refused (status ${response.status})`);
      }
      await done;
    } catch (err) {
      deps.log('error', `Gateway session error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (signal.aborted) return;

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= HEALTHY_SESSION_MS) {
      backoffMs = INITIAL_BACKOFF_MS;
      consecutiveFailures = 0;
      deps.log('info', 'Gateway session ended; reconnecting');
      await sleep(RECONNECT_DELAY_MS, signal);
      continue;
    }

    // Short session: the adapter swallows login errors, so treat this as a
    // failed connect regardless of how "clean" the end looked.
    consecutiveFailures += 1;
    let check: GatewayTokenCheck;
    try {
      check = await deps.checkToken();
    } catch {
      check = 'unreachable';
    }
    if (signal.aborted) return;
    if (check === 'invalid') {
      deps.log(
        'error',
        'Discord rejected the bot token (401); Gateway reconnection is parked until configure() supplies new credentials. ' +
          'Reset tokens must be rotated in the Discord Developer Portal and updated wherever this provider gets its credentials.',
      );
      return;
    }
    if (consecutiveFailures === SHORT_SESSION_HINT_THRESHOLD) {
      deps.log(
        'error',
        `Gateway sessions keep ending within ${HEALTHY_SESSION_MS / 1000}s of starting. The token checks out over REST, ` +
          `so the usual cause is a rejected IDENTIFY: enable the "Message Content Intent" (a privileged intent) for this ` +
          `app in the Discord Developer Portal, or set gateway: false for an interactions-only deployment.`,
      );
    }
    deps.log(
      'warn',
      `Gateway session ended after ${Math.round(elapsedMs / 1000)}s; retrying in ${Math.round(backoffMs / 1000)}s`,
    );
    await sleep(backoffMs, signal);
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
  }
}

/** Abortable sleep: resolves early (never rejects) when the signal fires. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
