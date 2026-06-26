import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { transcriptReducer, initialTranscript } from '../../src/web/ui/transcript';

/**
 * Tokens/sec EMA computation — tested by driving the transcript reducer
 * directly with usage_update events, the same way the real SSE stream does.
 * No server round-trip needed.
 */

describe('tokens/sec (reducer-level)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes instantaneous rate on first pair of usage_update events', () => {
    // First event: sets baseline timestamp/tokens, no rate yet
    vi.setSystemTime(1000);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 50, totalTokens: 60 } } as any,
    });
    expect(state.tokensPerSec).toBe(0);
    expect(state._prevCompletionTokens).toBe(10);

    // Second event 1s later: 20 new completion tokens in 1s = 10 tok/s
    vi.setSystemTime(2000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 50, totalTokens: 70 } } as any,
    });
    expect(state.tokensPerSec).toBe(10);
  });

  it('applies EMA smoothing (α=0.3) across multiple usage_update events', () => {
    vi.setSystemTime(1000);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 0, totalTokens: 10 } } as any,
    });

    // Event 2: instantaneous = 10 tok/s (first EMA value)
    vi.setSystemTime(2000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 0, totalTokens: 20 } } as any,
    });
    expect(state.tokensPerSec).toBe(10);

    // Event 3: 20 tokens in 1s → instantaneous = 20
    // EMA = 0.3 * 20 + 0.7 * 10 = 13
    vi.setSystemTime(3000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 0, totalTokens: 40 } } as any,
    });
    expect(state.tokensPerSec).toBe(13);

    // Event 4: 30 tokens in 1s → instantaneous = 30
    // EMA = 0.3 * 30 + 0.7 * 13 = 9 + 9.1 = 18.1 → 18
    vi.setSystemTime(4000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 70, promptTokens: 0, totalTokens: 70 } } as any,
    });
    expect(state.tokensPerSec).toBe(18);
  });

  it('resets tokensPerSec to 0 on agent_end', () => {
    // Get state with a non-zero tokensPerSec
    vi.setSystemTime(1000);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 0, totalTokens: 10 } } as any,
    });
    vi.setSystemTime(2000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 30, promptTokens: 0, totalTokens: 30 } } as any,
    });
    expect(state.tokensPerSec).toBe(20); // 20 tokens / 1 second

    // agent_end resets
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'agent_end', reason: 'done' } as any,
    });
    expect(state.tokensPerSec).toBe(0);
    expect(state._prevTokenTimestamp).toBe(0);
  });

  it('does not change rate when completionTokens has not increased', () => {
    vi.setSystemTime(1000);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 0, totalTokens: 10 } } as any,
    });

    // Same completion count, different prompt tokens — no rate change
    vi.setSystemTime(2000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 50, totalTokens: 60 } } as any,
    });
    expect(state.tokensPerSec).toBe(0);
  });

  it('shows full streaming lifecycle: start → rate builds → end resets', () => {
    // agent_start
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'agent_start' } as any,
    });
    expect(state.running).toBe(true);
    expect(state.tokensPerSec).toBe(0);

    // Streaming: multiple usage_update events building EMA
    vi.setSystemTime(1000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 5, promptTokens: 100, totalTokens: 105 } } as any,
    });

    vi.setSystemTime(1500);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 15, promptTokens: 100, totalTokens: 115 } } as any,
    });
    // 10 tokens in 0.5s = 20 tok/s (first EMA)
    expect(state.tokensPerSec).toBe(20);

    vi.setSystemTime(2000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 30, promptTokens: 100, totalTokens: 130 } } as any,
    });
    // 15 tokens in 0.5s = 30 tok/s instantaneous
    // EMA = 0.3 * 30 + 0.7 * 20 = 9 + 14 = 23
    expect(state.tokensPerSec).toBe(23);

    // agent_end resets everything
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'agent_end', reason: 'done' } as any,
    });
    expect(state.running).toBe(false);
    expect(state.tokensPerSec).toBe(0);
  });
});
