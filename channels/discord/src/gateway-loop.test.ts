import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HEALTHY_SESSION_MS,
  INITIAL_BACKOFF_MS,
  MAX_BACKOFF_MS,
  RECONNECT_DELAY_MS,
  runGatewayLoop,
} from './gateway-loop';
import type { GatewayLoopDeps, GatewayTokenCheck } from './gateway-loop';

/**
 * Plain-data tests for the provider-owned Gateway reconnect loop. The fake
 * session mirrors the two adapter behaviors the loop must survive:
 *
 * - login failures are swallowed — the session promise resolves "cleanly"
 *   within milliseconds instead of rejecting, and
 * - an abort resolves the in-flight session promise (the adapter's abort
 *   listener destroys the client and resolves).
 */

interface FakeSession {
  end: () => void;
  fail: (err: unknown) => void;
  signal: AbortSignal;
}

function makeHarness(
  opts: { check?: GatewayTokenCheck; checkThrows?: boolean; refuse?: boolean; autoEnd?: boolean } = {},
) {
  const sessions: FakeSession[] = [];
  const logs: string[] = [];
  const startSession = vi.fn(
    async (options: { waitUntil: (p: Promise<unknown>) => void }, _durationMs: number, signal: AbortSignal) => {
      if (opts.refuse) return new Response('chat not initialized', { status: 500 });
      let end!: () => void;
      let fail!: (err: unknown) => void;
      const lifetime = new Promise<void>((resolve, reject) => {
        end = resolve;
        fail = reject;
      });
      const session: FakeSession = { end, fail, signal };
      sessions.push(session);
      // Mirror the real adapter: abort resolves the session promise.
      signal.addEventListener('abort', () => end(), { once: true });
      options.waitUntil(lifetime);
      if (opts.autoEnd) end(); // instantly-"successful" failed login
      return new Response('{"status":"listening"}', { status: 200 });
    },
  );
  const checkToken = vi.fn(async (): Promise<GatewayTokenCheck> => {
    if (opts.checkThrows) throw new Error('network down');
    return opts.check ?? 'valid';
  });
  const deps: GatewayLoopDeps = {
    startSession,
    checkToken,
    log: (level, message) => {
      logs.push(`${level}: ${message}`);
    },
  };
  return { deps, startSession, checkToken, sessions, logs };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runGatewayLoop', () => {
  it('never reconnects immediately after an instantly-ending session, and backs off exponentially', async () => {
    // This is the exact failure that tripped Discord's 1000-connect tripwire:
    // the adapter swallows a rejected IDENTIFY, so the session "ends cleanly"
    // in milliseconds and a zero-delay loop hammers IDENTIFY forever.
    const { deps, startSession, sessions } = makeHarness();
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    expect(startSession).toHaveBeenCalledTimes(1);
    sessions[0]!.end();
    await vi.advanceTimersByTimeAsync(0);
    // No zero-delay reconnect.
    expect(startSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS - 1);
    expect(startSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(startSession).toHaveBeenCalledTimes(2);

    // Second failure doubles the delay.
    sessions[1]!.end();
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 2 - 1);
    expect(startSession).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(startSession).toHaveBeenCalledTimes(3);

    controller.abort();
    await loop;
  });

  it('caps the retry delay at MAX_BACKOFF_MS', async () => {
    const { deps, startSession } = makeHarness({ autoEnd: true });
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    expect(startSession).toHaveBeenCalledTimes(1);
    // Walk the doubling schedule until it would exceed the cap.
    let delay = INITIAL_BACKOFF_MS;
    let calls = 1;
    while (delay < MAX_BACKOFF_MS) {
      await vi.advanceTimersByTimeAsync(delay);
      calls += 1;
      expect(startSession).toHaveBeenCalledTimes(calls);
      delay = Math.min(delay * 2, MAX_BACKOFF_MS);
    }
    // From here on every retry waits exactly the cap.
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS - 1);
    expect(startSession).toHaveBeenCalledTimes(calls);
    await vi.advanceTimersByTimeAsync(1);
    expect(startSession).toHaveBeenCalledTimes(calls + 1);
    await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS);
    expect(startSession).toHaveBeenCalledTimes(calls + 2);

    controller.abort();
    await loop;
  });

  it('treats a long session as healthy: reconnects after a short pause and resets the backoff', async () => {
    const { deps, startSession, sessions, checkToken } = makeHarness();
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    // One failure first, so a backoff is in place to reset.
    await vi.advanceTimersByTimeAsync(0);
    sessions[0]!.end();
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    expect(startSession).toHaveBeenCalledTimes(2);

    // Session 2 survives past the healthy threshold, then ends (scheduled
    // rollover / Discord-side close).
    await vi.advanceTimersByTimeAsync(HEALTHY_SESSION_MS);
    sessions[1]!.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(startSession).toHaveBeenCalledTimes(2); // still no instant reconnect
    checkToken.mockClear();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS);
    expect(startSession).toHaveBeenCalledTimes(3);
    // A healthy end is not a failure: no token check.
    expect(checkToken).not.toHaveBeenCalled();

    // The next failure starts back at the initial delay, not the doubled one.
    sessions[2]!.end();
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS - 1);
    expect(startSession).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(startSession).toHaveBeenCalledTimes(4);

    controller.abort();
    await loop;
  });

  it('parks the loop when the token check reports the token was revoked', async () => {
    const { deps, startSession, logs } = makeHarness({ check: 'invalid', autoEnd: true });
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    await loop; // resolves without the signal ever aborting
    expect(startSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(logs.some(line => line.includes('parked'))).toBe(true);
  });

  it('keeps backing off when the token check is unreachable — an outage is not a revocation', async () => {
    const { deps, startSession } = makeHarness({ check: 'unreachable', autoEnd: true });
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    expect(startSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    expect(startSession).toHaveBeenCalledTimes(2);

    controller.abort();
    await loop;
  });

  it('treats a thrown token check like unreachable', async () => {
    const { deps, startSession } = makeHarness({ checkThrows: true, autoEnd: true });
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    expect(startSession).toHaveBeenCalledTimes(2);

    controller.abort();
    await loop;
  });

  it('does not hang on a refused session (non-2xx Response, waitUntil never invoked)', async () => {
    // The adapter answers 500 without delivering a session promise when its
    // chat instance is missing — awaiting that session would block forever.
    const { deps, startSession, logs } = makeHarness({ refuse: true });
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    expect(startSession).toHaveBeenCalledTimes(1);
    expect(logs.some(line => line.includes('refused'))).toBe(true);
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    expect(startSession).toHaveBeenCalledTimes(2);

    controller.abort();
    await loop;
  });

  it('a rejected session promise is a failed connect, not a crash', async () => {
    const { deps, startSession, sessions } = makeHarness();
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    sessions[0]!.fail(new Error('socket hang up'));
    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    expect(startSession).toHaveBeenCalledTimes(2);

    controller.abort();
    await loop;
  });

  it('abort during an open session ends the loop without another connect', async () => {
    const { deps, startSession } = makeHarness();
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    expect(startSession).toHaveBeenCalledTimes(1);
    controller.abort(); // the fake session resolves itself on abort, like the adapter
    await loop;
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it('abort during a backoff sleep exits promptly without waiting out the delay', async () => {
    const { deps, startSession, sessions } = makeHarness();
    const controller = new AbortController();
    const loop = runGatewayLoop(deps, controller.signal);

    await vi.advanceTimersByTimeAsync(0);
    sessions[0]!.end();
    await vi.advanceTimersByTimeAsync(0); // now inside the 5s backoff sleep
    controller.abort();
    await loop; // resolves without advancing the clock
    expect(startSession).toHaveBeenCalledTimes(1);
  });
});
