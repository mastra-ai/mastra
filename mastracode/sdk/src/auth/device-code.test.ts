import { describe, expect, it, vi } from 'vitest';
import {
  abortableSleep,
  createDeviceCodePollState,
  nextPollDelayMs,
  pollDeviceCodeUntilComplete,
  stepDeviceCodePoll,
} from './device-code.js';
import type { DeviceCodePollOutcome, DeviceCodePollState } from './device-code.js';

const NOW = 1_700_000_000_000;

function makeState(overrides: Partial<DeviceCodePollState> = {}): DeviceCodePollState {
  return {
    deadlineAt: NOW + 900_000,
    intervalMs: 5000,
    slowDownResponses: 0,
    ...overrides,
  };
}

describe('createDeviceCodePollState', () => {
  it('uses the server-provided interval and expiry', () => {
    const state = createDeviceCodePollState({ intervalSeconds: 7, expiresInSeconds: 600, now: NOW });
    expect(state).toEqual({ deadlineAt: NOW + 600_000, intervalMs: 7000, slowDownResponses: 0 });
  });

  it('defaults the interval to 5 seconds per RFC 8628', () => {
    const state = createDeviceCodePollState({ expiresInSeconds: 600, now: NOW });
    expect(state.intervalMs).toBe(5000);
  });

  it('clamps sub-second intervals up to 1 second', () => {
    const state = createDeviceCodePollState({ intervalSeconds: 0.2, expiresInSeconds: 600, now: NOW });
    expect(state.intervalMs).toBe(1000);
  });

  it('round-trips through JSON', () => {
    const state = createDeviceCodePollState({ intervalSeconds: 5, expiresInSeconds: 600, now: NOW });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});

describe('nextPollDelayMs', () => {
  it('applies the initial multiplier before any slow_down', () => {
    expect(nextPollDelayMs(makeState(), NOW)).toBe(6000); // 5000 * 1.2
  });

  it('applies the slow_down multiplier after a slow_down response', () => {
    expect(nextPollDelayMs(makeState({ slowDownResponses: 1 }), NOW)).toBe(7000); // 5000 * 1.4
  });

  it('clamps the delay to the remaining lifetime', () => {
    expect(nextPollDelayMs(makeState({ deadlineAt: NOW + 2000 }), NOW)).toBe(2000);
  });
});

describe('stepDeviceCodePoll', () => {
  it('returns complete with the poll result', async () => {
    const state = makeState();
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'complete', result: 'token' }), NOW);
    expect(step).toEqual({ status: 'complete', result: 'token', state });
  });

  it('returns pending with the next poll delay', async () => {
    const state = makeState();
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'pending' }), NOW);
    expect(step).toEqual({ status: 'pending', nextPollMs: 6000, state });
  });

  it('adopts a server-provided interval on pending', async () => {
    const state = makeState();
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'pending', intervalSeconds: 10 }), NOW);
    expect(step.state.intervalMs).toBe(10_000);
    expect(step.status === 'pending' && step.nextPollMs).toBe(12_000);
  });

  it('grows the interval by 5s on slow_down without a server interval', async () => {
    const state = makeState();
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'slow_down' }), NOW);
    expect(step.state).toEqual({ ...state, slowDownResponses: 1, intervalMs: 10_000 });
    expect(step.status === 'slow_down' && step.nextPollMs).toBe(14_000); // 10000 * 1.4
  });

  it('uses the server-provided interval on slow_down', async () => {
    const state = makeState();
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'slow_down', intervalSeconds: 30 }), NOW);
    expect(step.state.intervalMs).toBe(30_000);
  });

  it('returns failed with the provider error', async () => {
    const state = makeState();
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'failed', error: 'access_denied' }), NOW);
    expect(step).toEqual({ status: 'failed', error: 'access_denied', state });
  });

  it('fails with a timeout error past the deadline without calling pollOnce', async () => {
    const pollOnce = vi.fn<() => Promise<DeviceCodePollOutcome<string>>>();
    const state = makeState({ deadlineAt: NOW - 1 });
    const step = await stepDeviceCodePoll(state, pollOnce, NOW);
    expect(step.status).toBe('failed');
    expect(step.status === 'failed' && step.error).toBe('Device flow timed out');
    expect(pollOnce).not.toHaveBeenCalled();
  });

  it('mentions clock drift when timing out after slow_down responses', async () => {
    const state = makeState({ deadlineAt: NOW - 1, slowDownResponses: 2 });
    const step = await stepDeviceCodePoll(state, async () => ({ status: 'pending' }), NOW);
    expect(step.status === 'failed' && step.error).toMatch(/clock drift/);
  });
});

describe('pollDeviceCodeUntilComplete', () => {
  const instantSleep = async () => {};

  it('polls until complete', async () => {
    const outcomes: DeviceCodePollOutcome<string>[] = [
      { status: 'pending' },
      { status: 'slow_down' },
      { status: 'pending' },
      { status: 'complete', result: 'token' },
    ];
    const result = await pollDeviceCodeUntilComplete({
      state: createDeviceCodePollState({ expiresInSeconds: 600 }),
      pollOnce: async () => outcomes.shift()!,
      sleep: instantSleep,
    });
    expect(result).toBe('token');
    expect(outcomes).toHaveLength(0);
  });

  it('throws the provider error on failure', async () => {
    await expect(
      pollDeviceCodeUntilComplete({
        state: createDeviceCodePollState({ expiresInSeconds: 600 }),
        pollOnce: async () => ({ status: 'failed', error: 'expired_token' }),
        sleep: instantSleep,
      }),
    ).rejects.toThrow('expired_token');
  });

  it('throws a timeout error when the deadline passes', async () => {
    await expect(
      pollDeviceCodeUntilComplete({
        state: createDeviceCodePollState({ expiresInSeconds: -1 }),
        pollOnce: async () => ({ status: 'pending' }),
        sleep: instantSleep,
      }),
    ).rejects.toThrow('Device flow timed out');
  });

  it('waits between polls', async () => {
    const sleeps: number[] = [];
    const outcomes: DeviceCodePollOutcome<string>[] = [
      { status: 'slow_down' },
      { status: 'complete', result: 'token' },
    ];
    await pollDeviceCodeUntilComplete({
      state: { deadlineAt: Date.now() + 900_000, intervalMs: 5000, slowDownResponses: 0 },
      pollOnce: async () => outcomes.shift()!,
      sleep: async ms => {
        sleeps.push(ms);
      },
    });
    expect(sleeps[0]).toBe(6000); // 5000 * 1.2 before first poll
    expect(sleeps[1]).toBe(14_000); // 10000 * 1.4 after slow_down
  });

  it('aborts via the signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      pollDeviceCodeUntilComplete({
        state: createDeviceCodePollState({ expiresInSeconds: 600 }),
        pollOnce: async () => ({ status: 'pending' }),
        signal: controller.signal,
      }),
    ).rejects.toThrow('Login cancelled');
  });
});

describe('abortableSleep', () => {
  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortableSleep(10_000, controller.signal)).rejects.toThrow('Login cancelled');
  });

  it('rejects when aborted mid-sleep', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const promise = abortableSleep(10_000, controller.signal);
      const assertion = expect(promise).rejects.toThrow('Login cancelled');
      controller.abort();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves after the delay', async () => {
    vi.useFakeTimers();
    try {
      const promise = abortableSleep(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
