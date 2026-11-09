import type { AgentControllerEvent } from '@mastra/client-js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  initialChatRuntime,
  runtimeReducer,
  type ChatRuntimeState,
} from '../../../factory-ui/src/ui/domains/chat/services/runtime';

type MessageUpdateEvent = Extract<AgentControllerEvent, { type: 'message_update' }>;

/**
 * Tokens/sec computation — tested by driving the chat runtime reducer directly
 * with the same event order the real SSE stream produces: generation deltas
 * (message_update/tool_input_delta) stream while the model decodes, then a
 * step-finish reports token usage (usage_update). The rate is measured over the
 * streamed generation window — first to last generation delta, including
 * streamed thinking and tool arguments — so TTFT and inter-step tool gaps do
 * not deflate it. No server round-trip.
 */

function assistantTextDelta(delta = 'x'): MessageUpdateEvent {
  return {
    type: 'message_update',
    id: 'assistant-1',
    event: { type: 'text-delta', delta },
  };
}

function assistantReasoningDelta(delta = 'Thinking'): MessageUpdateEvent {
  return {
    type: 'message_update',
    id: 'assistant-1',
    event: { type: 'reasoning-delta', index: 0, delta },
  };
}

interface DecodeStep {
  /** First generation delta opens the decode window. */
  startMs: number;
  /** Last generation delta closes the generation interval. */
  lastDeltaMs: number;
  /** Usage arrives later, after tool execution; it must not extend the window. */
  usageMs: number;
  completionTokens: number;
  reasoningTokens?: number;
}

/**
 * Drives one decode step: generation deltas stream between `startMs` and
 * `lastDeltaMs`, then usage lands at `usageMs` carrying the step's tokens.
 */
function decodeStep(state: ChatRuntimeState, step: DecodeStep): ChatRuntimeState {
  vi.setSystemTime(step.startMs);
  let next = runtimeReducer(state, { type: 'event', event: assistantTextDelta() });
  vi.setSystemTime(step.lastDeltaMs);
  next = runtimeReducer(next, { type: 'event', event: assistantTextDelta() });
  vi.setSystemTime(step.usageMs);
  return runtimeReducer(next, {
    type: 'event',
    event: {
      type: 'usage_update',
      usage: {
        completionTokens: step.completionTokens,
        reasoningTokens: step.reasoningTokens,
        promptTokens: 0,
        totalTokens: step.completionTokens,
      },
    },
  });
}

describe('tokens/sec (reducer-level)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes rate over the streamed generation window of a step', () => {
    // Generation spans t=1000..2000, so 20 tokens / 1s = 20 tok/s even though
    // usage only lands much later.
    const state = decodeStep(initialChatRuntime, {
      startMs: 1000,
      lastDeltaMs: 2000,
      usageMs: 90_000,
      completionTokens: 20,
    });
    expect(state.tokensPerSec).toBe(20);
    // Window re-arms after the step.
    expect(state._decodeStartedAt).toBe(0);
  });

  it('ignores TTFT/tool time before the first content delta', () => {
    // Generation begins at t=4000 and ends at t=5000, so the rate is
    // 20 tokens / 1s = 20 tok/s, not 20 / 9s.
    const state = decodeStep(initialChatRuntime, {
      startMs: 4000,
      lastDeltaMs: 5000,
      usageMs: 9000,
      completionTokens: 20,
    });
    expect(state.tokensPerSec).toBe(20);
  });

  it('includes streamed thinking and counts output tokens once', () => {
    // 2440 output tokens (2400 of them reasoning) over a 61s window that starts
    // with the reasoning delta: 2440 / 61 = 40 tok/s. Reasoning is a subset of
    // the provider's output, so it must not be added again.
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, { type: 'event', event: assistantReasoningDelta() });
    vi.setSystemTime(61_000);
    state = runtimeReducer(state, { type: 'event', event: assistantTextDelta() });
    vi.setSystemTime(62_000);
    state = runtimeReducer(state, { type: 'event', event: assistantTextDelta() });
    vi.setSystemTime(90_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { completionTokens: 2440, reasoningTokens: 2400, promptTokens: 0, totalTokens: 2440 },
      },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('counts thinking that starts after text in the same step', () => {
    // Text opens the window before any thinking streams. The thinking that follows still
    // happened inside it, so usage_update must not subtract those tokens as unmeasured.
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } },
    });
    expect(state._decodeHasReasoning).toBe(false);
    vi.setSystemTime(2000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } },
    });
    expect(state._decodeHasReasoning).toBe(true);
    vi.setSystemTime(90_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { promptTokens: 100, completionTokens: 40, reasoningTokens: 40, totalTokens: 140 },
      },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('measures visible output when reasoning tokens never streamed', () => {
    // A model can report reasoning tokens without emitting reasoning deltas. Only
    // the visible output can be timed, so 2440 output − 2400 hidden thinking = 40
    // tokens over 1s. Prior 10 → EMA = 0.3*40 + 0.7*10 = 19, so the readout still
    // shows a value instead of disappearing.
    vi.setSystemTime(1000);
    let state = runtimeReducer(
      { ...initialChatRuntime, tokensPerSec: 10 },
      { type: 'event', event: assistantTextDelta() },
    );
    vi.setSystemTime(2000);
    state = runtimeReducer(state, { type: 'event', event: assistantTextDelta() });
    vi.setSystemTime(3000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { completionTokens: 2440, reasoningTokens: 2400, promptTokens: 0, totalTokens: 2440 },
      },
    });
    expect(state.tokensPerSec).toBe(19);
  });

  it('applies EMA smoothing (α=0.3) across decode steps', () => {
    // Step 1: 10 tokens / 1s = 10 tok/s (first EMA value).
    let state = decodeStep(initialChatRuntime, {
      startMs: 1000,
      lastDeltaMs: 2000,
      usageMs: 90_000,
      completionTokens: 10,
    });
    expect(state.tokensPerSec).toBe(10);

    // Step 2: 20 tokens / 1s = 20 instantaneous. EMA = 0.3*20 + 0.7*10 = 13.
    state = decodeStep(state, {
      startMs: 3000,
      lastDeltaMs: 4000,
      usageMs: 90_000,
      completionTokens: 20,
    });
    expect(state.tokensPerSec).toBe(13);

    // Step 3: 30 tokens / 1s = 30 instantaneous. EMA = 0.3*30 + 0.7*13 = 18.1 → 18.
    state = decodeStep(state, {
      startMs: 5000,
      lastDeltaMs: 6000,
      usageMs: 90_000,
      completionTokens: 30,
    });
    expect(state.tokensPerSec).toBe(18);
  });

  it('keeps the last rate visible after agent_end, clearing only on the next agent_start', () => {
    let state = decodeStep(initialChatRuntime, {
      startMs: 1000,
      lastDeltaMs: 2000,
      usageMs: 90_000,
      completionTokens: 30,
    });
    expect(state.tokensPerSec).toBe(30); // 30 tokens / 1 second

    // agent_end persists the reading (so short turns stay readable) but clears
    // the in-flight window.
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'agent_end', reason: 'done' },
    });
    expect(state.tokensPerSec).toBe(30);
    expect(state._decodeStartedAt).toBe(0);

    // The next turn's agent_start clears it for a fresh measurement.
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'agent_start' },
    });
    expect(state.tokensPerSec).toBe(0);
    expect(state._decodeStartedAt).toBe(0);
  });

  it('does not compute a rate for a tool-only step with no streamed content', () => {
    // No generation delta means the window never opened; a usage_update with
    // 0 completion tokens (pure tool call) must not produce a rate.
    vi.setSystemTime(2000);
    const state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 0, promptTokens: 50, totalTokens: 50 } },
    });
    expect(state.tokensPerSec).toBe(0);
  });

  it('measures streamed tool-argument generation without counting tool execution', () => {
    // The model streams tool arguments between t=1000 and t=2000, then the tool
    // runs until t=60000. Decode time is the 1s of generation: 40 tok/s.
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{' },
    });
    vi.setSystemTime(2000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '}' },
    });
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 100, totalTokens: 140 } },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('does not carry the generation window into the next step when a step reported no usage', () => {
    // Step 1 streams then never reports usage. Step 2 is a different assistant message
    // generating at 30_000/31_000: its 40 tokens must be timed over that 1s, not the
    // 29s window step 1 left open.
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'message_update', id: 'step-1', event: { type: 'text-delta', delta: 'One' } },
    });
    vi.setSystemTime(30_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'message_update', id: 'step-2', event: { type: 'text-delta', delta: 'Two' } },
    });
    vi.setSystemTime(31_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'message_update', id: 'step-2', event: { type: 'text-delta', delta: ' continues' } },
    });
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 100, totalTokens: 140 } },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('does not leak a usage-less step into a step whose first output is tool arguments', () => {
    // Step 1 streams then never reports usage. Step 2's first output is tool arguments,
    // which arrive before its message_start: they must be timed over their own 1s, not
    // the 29s window step 1 left open.
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'message_update', id: 'step-1', event: { type: 'text-delta', delta: 'One' } },
    });
    vi.setSystemTime(30_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{"path"', messageId: 'step-2' },
    });
    vi.setSystemTime(31_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: ':"a.ts"}', messageId: 'step-2' },
    });
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 100, totalTokens: 140 } },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('still measures a step whose message closed before its usage arrived', () => {
    // The goal path closes the assistant message before the step's step-finish, so
    // message_end lands first. The pending usage must still measure that step.
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, { type: 'event', event: assistantTextDelta() });
    vi.setSystemTime(2000);
    state = runtimeReducer(state, { type: 'event', event: assistantTextDelta() });
    state = runtimeReducer(state, { type: 'event', event: { type: 'message_end', id: 'assistant-1' } });
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 100, totalTokens: 140 } },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('shows full streaming lifecycle: start → rate builds → end persists → next start clears', () => {
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'agent_start' },
    });
    expect(state.tokensPerSec).toBe(0);

    // Step 1: 10 tokens over 0.5s generation = 20 tok/s (first EMA).
    state = decodeStep(state, {
      startMs: 1000,
      lastDeltaMs: 1500,
      usageMs: 90_000,
      completionTokens: 10,
    });
    expect(state.tokensPerSec).toBe(20);

    // Step 2: 15 tokens over 0.5s generation = 30 instantaneous.
    // EMA = 0.3*30 + 0.7*20 = 9 + 14 = 23.
    state = decodeStep(state, {
      startMs: 2000,
      lastDeltaMs: 2500,
      usageMs: 91_000,
      completionTokens: 15,
    });
    expect(state.tokensPerSec).toBe(23);

    // Turn ends: stop running but keep the last reading visible while idle.
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'agent_end', reason: 'done' },
    });
    expect(state.tokensPerSec).toBe(23);

    // The next turn clears it on agent_start.
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'agent_start' },
    });
    expect(state.tokensPerSec).toBe(0);
  });
});
