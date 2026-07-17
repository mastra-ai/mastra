import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { transcriptReducer, initialTranscript } from '../../src/web/ui/domains/chat/services/transcript';
import type { TranscriptState } from '../../src/web/ui/domains/chat/services/transcript';

/**
 * Tokens/sec computation — tested by driving the transcript reducer directly
 * with the same event order the real SSE stream produces: content deltas
 * (message_update) stream while the model decodes, then a step-finish reports
 * token usage (usage_update). The rate is measured over the decode window only,
 * so TTFT and inter-step tool gaps do not deflate it. No server round-trip.
 */

function assistantTextMessage(text: string): MastraDBMessage {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

/**
 * Drives one decode step: message_update opens the decode window at `startMs`,
 * usage_update closes it at `endMs` carrying the step's tokens.
 */
function decodeStep(
  state: TranscriptState,
  opts: { startMs: number; endMs: number; completionTokens: number; reasoningTokens?: number },
): TranscriptState {
  vi.setSystemTime(opts.startMs);
  let next = transcriptReducer(state, {
    type: 'event',
    event: { type: 'message_update', message: assistantTextMessage('x') } as any,
  });
  vi.setSystemTime(opts.endMs);
  next = transcriptReducer(next, {
    type: 'event',
    event: {
      type: 'usage_update',
      usage: {
        completionTokens: opts.completionTokens,
        reasoningTokens: opts.reasoningTokens,
        promptTokens: 0,
        totalTokens: opts.completionTokens,
      },
    } as any,
  });
  return next;
}

describe('tokens/sec (reducer-level)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes rate over the decode window of a step', () => {
    // Decode opens at t=1000, step-finish at t=2000 → 20 tokens / 1s = 20 tok/s.
    const state = decodeStep(initialTranscript, { startMs: 1000, endMs: 2000, completionTokens: 20 });
    expect(state.tokensPerSec).toBe(20);
    // Window re-arms after step-finish.
    expect(state._decodeStartedAt).toBe(0);
  });

  it('ignores TTFT/tool time before the first content delta', () => {
    // usage arrives at t=5000 but decoding only began at t=4000, so the rate is
    // 20 tokens / 1s = 20 tok/s, not 20 / 4s.
    vi.setSystemTime(4000);
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_update', message: assistantTextMessage('x') } as any,
    });
    vi.setSystemTime(5000);
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 0, totalTokens: 20 } } as any,
    });
    expect(state.tokensPerSec).toBe(20);
  });

  it('includes reasoning tokens in the decode rate', () => {
    // 10 completion + 10 reasoning = 20 tokens / 1s = 20 tok/s.
    const state = decodeStep(initialTranscript, {
      startMs: 1000,
      endMs: 2000,
      completionTokens: 10,
      reasoningTokens: 10,
    });
    expect(state.tokensPerSec).toBe(20);
  });

  it('applies EMA smoothing (α=0.3) across decode steps', () => {
    // Step 1: 10 tokens / 1s = 10 tok/s (first EMA value).
    let state = decodeStep(initialTranscript, { startMs: 1000, endMs: 2000, completionTokens: 10 });
    expect(state.tokensPerSec).toBe(10);

    // Step 2: 20 tokens / 1s = 20 instantaneous. EMA = 0.3*20 + 0.7*10 = 13.
    state = decodeStep(state, { startMs: 3000, endMs: 4000, completionTokens: 20 });
    expect(state.tokensPerSec).toBe(13);

    // Step 3: 30 tokens / 1s = 30 instantaneous. EMA = 0.3*30 + 0.7*13 = 18.1 → 18.
    state = decodeStep(state, { startMs: 5000, endMs: 6000, completionTokens: 30 });
    expect(state.tokensPerSec).toBe(18);
  });

  it('keeps the last rate visible after agent_end, clearing only on the next agent_start', () => {
    let state = decodeStep(initialTranscript, { startMs: 1000, endMs: 2000, completionTokens: 30 });
    expect(state.tokensPerSec).toBe(30); // 30 tokens / 1 second

    // agent_end persists the reading (so short turns stay readable) but clears
    // the in-flight decode window.
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'agent_end', reason: 'done' } as any,
    });
    expect(state.tokensPerSec).toBe(30);
    expect(state._decodeStartedAt).toBe(0);

    // The next turn's agent_start clears it for a fresh measurement.
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'agent_start' } as any,
    });
    expect(state.tokensPerSec).toBe(0);
    expect(state._decodeStartedAt).toBe(0);
  });

  it('does not compute a rate for a tool-only step with no streamed content', () => {
    // No message_update means the decode window never opened; a usage_update with
    // 0 completion tokens (pure tool call) must not produce a rate.
    vi.setSystemTime(2000);
    const state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 0, promptTokens: 50, totalTokens: 50 } } as any,
    });
    expect(state.tokensPerSec).toBe(0);
  });

  it('shows full streaming lifecycle: start → rate builds → end persists → next start clears', () => {
    let state = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'agent_start' } as any,
    });
    expect(state.tokensPerSec).toBe(0);

    // Step 1: 10 tokens over 0.5s decode = 20 tok/s (first EMA).
    state = decodeStep(state, { startMs: 1000, endMs: 1500, completionTokens: 10 });
    expect(state.tokensPerSec).toBe(20);

    // Step 2: 15 tokens over 0.5s decode = 30 instantaneous.
    // EMA = 0.3*30 + 0.7*20 = 9 + 14 = 23.
    state = decodeStep(state, { startMs: 2000, endMs: 2500, completionTokens: 15 });
    expect(state.tokensPerSec).toBe(23);

    // Turn ends: stop running but keep the last reading visible while idle.
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'agent_end', reason: 'done' } as any,
    });
    expect(state.tokensPerSec).toBe(23);

    // The next turn clears it on agent_start.
    state = transcriptReducer(state, {
      type: 'event',
      event: { type: 'agent_start' } as any,
    });
    expect(state.tokensPerSec).toBe(0);
  });
});
