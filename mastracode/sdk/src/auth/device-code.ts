/**
 * Generic RFC 8628 (OAuth 2.0 Device Authorization Grant) polling helpers.
 *
 * Ported from pi-mono's device-code utility, restructured as a single-step
 * API so the same poll semantics can be driven two ways:
 *   - `pollDeviceCodeUntilComplete()` — blocking loop for TUI flows.
 *   - `stepDeviceCodePoll()` — exactly one upstream poll per call, with a
 *     JSON-serializable `DeviceCodePollState` so web routes can persist the
 *     state between HTTP requests (any replica can continue the poll).
 *
 * Inspired by pi-mono:
 * https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/oauth/device-code.ts
 */

const DEFAULT_INTERVAL_SECONDS = 5;
const INITIAL_POLL_INTERVAL_MULTIPLIER = 1.2;
const SLOW_DOWN_POLL_INTERVAL_MULTIPLIER = 1.4;
const SLOW_DOWN_INTERVAL_INCREMENT_MS = 5000;

/**
 * Serializable poll-loop state. Safe to round-trip through JSON (e.g. a
 * `pending jsonb` column) so device-code polling can span HTTP requests.
 */
export interface DeviceCodePollState {
  /** ms epoch after which the device authorization is considered expired. */
  deadlineAt: number;
  /** Current base poll interval in ms (grows on slow_down responses). */
  intervalMs: number;
  /** Number of slow_down responses observed so far. */
  slowDownResponses: number;
}

export function createDeviceCodePollState(options: {
  /** Poll interval suggested by the server, in seconds. Defaults to 5 (RFC 8628). */
  intervalSeconds?: number;
  /** Lifetime of the device code, in seconds. */
  expiresInSeconds: number;
  /** Override "now" for tests. */
  now?: number;
}): DeviceCodePollState {
  const now = options.now ?? Date.now();
  const intervalSeconds =
    typeof options.intervalSeconds === 'number' && options.intervalSeconds > 0
      ? options.intervalSeconds
      : DEFAULT_INTERVAL_SECONDS;
  return {
    deadlineAt: now + options.expiresInSeconds * 1000,
    intervalMs: Math.max(1000, Math.floor(intervalSeconds * 1000)),
    slowDownResponses: 0,
  };
}

/**
 * Classified result of one upstream token-endpoint poll. Providers implement
 * the HTTP request and map their response shape onto this union.
 */
export type DeviceCodePollOutcome<T> =
  | { status: 'complete'; result: T }
  | { status: 'pending'; intervalSeconds?: number }
  | { status: 'slow_down'; intervalSeconds?: number }
  | { status: 'failed'; error: string };

export type DeviceCodeStepResult<T> =
  | { status: 'complete'; result: T; state: DeviceCodePollState }
  | { status: 'pending'; nextPollMs: number; state: DeviceCodePollState }
  | { status: 'slow_down'; nextPollMs: number; state: DeviceCodePollState }
  | { status: 'failed'; error: string; state: DeviceCodePollState };

function timeoutMessage(state: DeviceCodePollState): string {
  if (state.slowDownResponses > 0) {
    // Repeated slow_down responses followed by a timeout usually means the
    // local clock is behind the server's (common in WSL/VMs after sleep).
    return 'Device flow timed out after one or more slow_down responses. This is often caused by clock drift in WSL or VM environments. Please sync or restart the VM clock and try again.';
  }
  return 'Device flow timed out';
}

/**
 * Delay to wait before the next poll, honoring slow_down growth and clamped
 * to the remaining lifetime of the device code.
 */
export function nextPollDelayMs(state: DeviceCodePollState, now: number = Date.now()): number {
  const multiplier =
    state.slowDownResponses > 0 ? SLOW_DOWN_POLL_INTERVAL_MULTIPLIER : INITIAL_POLL_INTERVAL_MULTIPLIER;
  const remainingMs = Math.max(0, state.deadlineAt - now);
  return Math.min(Math.ceil(state.intervalMs * multiplier), remainingMs);
}

/**
 * Perform exactly one upstream poll and fold the outcome into the poll state.
 * Never throws for flow-level conditions — timeouts and provider errors are
 * reported as `{ status: 'failed' }` so callers can persist/report them.
 */
export async function stepDeviceCodePoll<T>(
  state: DeviceCodePollState,
  pollOnce: () => Promise<DeviceCodePollOutcome<T>>,
  now: number = Date.now(),
): Promise<DeviceCodeStepResult<T>> {
  if (now >= state.deadlineAt) {
    return { status: 'failed', error: timeoutMessage(state), state };
  }

  const outcome = await pollOnce();

  switch (outcome.status) {
    case 'complete':
      return { status: 'complete', result: outcome.result, state };
    case 'failed':
      return { status: 'failed', error: outcome.error, state };
    case 'slow_down': {
      const next: DeviceCodePollState = {
        ...state,
        slowDownResponses: state.slowDownResponses + 1,
        // RFC 8628 section 3.5: grow the interval by 5 seconds, unless the
        // server told us the interval to use.
        intervalMs:
          typeof outcome.intervalSeconds === 'number' && outcome.intervalSeconds > 0
            ? outcome.intervalSeconds * 1000
            : Math.max(1000, state.intervalMs + SLOW_DOWN_INTERVAL_INCREMENT_MS),
      };
      return { status: 'slow_down', nextPollMs: nextPollDelayMs(next, now), state: next };
    }
    case 'pending': {
      const next: DeviceCodePollState =
        typeof outcome.intervalSeconds === 'number' && outcome.intervalSeconds > 0
          ? { ...state, intervalMs: Math.max(1000, outcome.intervalSeconds * 1000) }
          : state;
      return { status: 'pending', nextPollMs: nextPollDelayMs(next, now), state: next };
    }
  }
}

/** Sleep that can be interrupted by an AbortSignal. */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Login cancelled'));
      return;
    }

    let timeout: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error('Login cancelled'));
    };

    timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Blocking poll loop for TUI flows: waits the appropriate interval between
 * polls, honors slow_down growth, aborts on the signal, and throws on
 * failure/timeout (with a clock-drift hint after slow_down responses).
 */
export async function pollDeviceCodeUntilComplete<T>(options: {
  state: DeviceCodePollState;
  pollOnce: () => Promise<DeviceCodePollOutcome<T>>;
  signal?: AbortSignal;
  /** Override the sleep implementation for tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}): Promise<T> {
  let state = options.state;
  const sleep = options.sleep ?? abortableSleep;

  while (true) {
    if (options.signal?.aborted) {
      throw new Error('Login cancelled');
    }
    if (Date.now() >= state.deadlineAt) {
      throw new Error(timeoutMessage(state));
    }

    await sleep(nextPollDelayMs(state), options.signal);

    const step = await stepDeviceCodePoll(state, options.pollOnce);
    state = step.state;

    if (step.status === 'complete') {
      return step.result;
    }
    if (step.status === 'failed') {
      throw new Error(step.error);
    }
  }
}
