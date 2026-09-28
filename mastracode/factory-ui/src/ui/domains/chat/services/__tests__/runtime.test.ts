import type { AgentControllerEvent } from '@mastra/client-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { omWork } from '../om';
import { initialChatRuntime, runtimeReducer } from '../runtime';

type MessageUpdateEvent = Extract<AgentControllerEvent, { type: 'message_update' }>;

describe('chat runtime status', () => {
  afterEach(() => vi.useRealTimers());

  it.each([2400, undefined])(
    'includes the thinking interval and counts output once (reasoning usage: %s)',
    reasoningTokens => {
      vi.useFakeTimers();
      let state = initialChatRuntime;
      const emit = (at: number, event: AgentControllerEvent) => {
        vi.setSystemTime(at);
        state = runtimeReducer(state, { type: 'event', event });
      };
      emit(1000, { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } });
      emit(61_000, { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } });
      emit(62_000, { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: ' complete' } });
      emit(90_000, {
        type: 'usage_update',
        usage: { promptTokens: 100, completionTokens: 2440, reasoningTokens, totalTokens: 2540 },
      });
      expect(state.tokensPerSec).toBe(40);
    },
  );

  it.each(['tool', 'reasoning'] as const)('measures %s-only generation without waiting for usage delivery', kind => {
    vi.useFakeTimers();
    let state = initialChatRuntime;
    const delta: AgentControllerEvent =
      kind === 'tool'
        ? { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{}' }
        : { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } };
    for (const at of [1000, 2000]) {
      vi.setSystemTime(at);
      state = runtimeReducer(state, { type: 'event', event: delta });
    }
    vi.setSystemTime(30_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: {
          promptTokens: 100,
          completionTokens: 40,
          reasoningTokens: kind === 'reasoning' ? 40 : 0,
          totalTokens: 140,
        },
      },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('counts thinking that starts after text in the same step', () => {
    // Text opens the window before any thinking streams. The thinking that follows still
    // happened inside it, so usage_update must not subtract those tokens as unmeasured.
    vi.useFakeTimers();
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

  it('preserves the last rate when no generation interval was observed', () => {
    vi.useFakeTimers();
    let state = { ...initialChatRuntime, tokensPerSec: 40 };
    const delta: AgentControllerEvent = {
      type: 'message_update',
      id: 'm',
      event: { type: 'text-delta', delta: 'Answer' },
    };
    for (const at of [1000, 1000]) {
      vi.setSystemTime(at);
      state = runtimeReducer(state, { type: 'event', event: delta });
    }
    vi.setSystemTime(3000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { promptTokens: 100, completionTokens: 2440, reasoningTokens: 0, totalTokens: 2540 },
      },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('measures visible output when reasoning tokens never streamed', () => {
    // 2440 output tokens of which 2400 are thinking that never streamed: only the
    // 40 visible tokens can be timed. Prior 10 → EMA = 0.3*40 + 0.7*10 = 19.
    vi.useFakeTimers();
    let state = { ...initialChatRuntime, tokensPerSec: 10 };
    for (const at of [1000, 2000]) {
      vi.setSystemTime(at);
      state = runtimeReducer(state, {
        type: 'event',
        event: { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } },
      });
    }
    vi.setSystemTime(3000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { promptTokens: 100, completionTokens: 2440, reasoningTokens: 2400, totalTokens: 2540 },
      },
    });
    expect(state.tokensPerSec).toBe(19);
  });

  it('allows the captured 13ms tool-argument burst without counting tool execution', () => {
    vi.useFakeTimers();
    vi.setSystemTime(3600);
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{' },
    });
    vi.setSystemTime(3613);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '}' },
    });
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { completionTokens: 170, promptTokens: 100, totalTokens: 270 },
      },
    });
    expect(state.tokensPerSec).toBe(13077);
  });

  it('does not carry the generation window into the next step when a step reported no usage', () => {
    // Step 1 streams at 1000 then never reports usage. Step 2 is a different assistant
    // message generating between 2000 and 31_000's second delta: its 40 tokens must be
    // timed over that 1s, not the 29s window left open by step 1.
    vi.useFakeTimers();
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
    // Step 1 streams text at 1000 then never reports usage. Step 2's first output is tool
    // arguments, which arrive before its message_start: their step must be timed over its
    // own 1s, not the 29s window step 1 left open.
    vi.useFakeTimers();
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

  it('rebinds the window between two argument-only steps', () => {
    vi.useFakeTimers();
    const deltas: [number, string][] = [
      [1000, 'step-1'],
      [2000, 'step-1'],
      [30_000, 'step-2'],
      [31_000, 'step-2'],
    ];
    let state = initialChatRuntime;
    for (const [at, messageId] of deltas) {
      vi.setSystemTime(at);
      state = runtimeReducer(state, {
        type: 'event',
        event: { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{', messageId },
      });
    }
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
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } },
    });
    vi.setSystemTime(2000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: ' complete' } },
    });
    state = runtimeReducer(state, { type: 'event', event: { type: 'message_end', id: 'm' } });
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 100, totalTokens: 140 } },
    });
    expect(state.tokensPerSec).toBe(40);
  });

  it('preserves the last reading when no generation deltas were received', () => {
    const state = runtimeReducer(
      { ...initialChatRuntime, tokensPerSec: 40 },
      {
        type: 'event',
        event: {
          type: 'usage_update',
          usage: { completionTokens: 5000, promptTokens: 100, totalTokens: 5100 },
        },
      },
    );
    expect(state.tokensPerSec).toBe(40);
  });

  it('excludes initial wait and does not cap legitimate high throughput', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    let state = runtimeReducer(initialChatRuntime, { type: 'event', event: { type: 'agent_start' } });
    for (const at of [9000, 11000]) {
      vi.setSystemTime(at);
      state = runtimeReducer(state, {
        type: 'event',
        event: { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Output' } },
      });
    }
    vi.setSystemTime(60_000);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { completionTokens: 1200, promptTokens: 100, totalTokens: 1300 },
      },
    });
    expect(state.tokensPerSec).toBe(600);
  });

  it('ignores empty deltas and tool-result replay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const events: AgentControllerEvent[] = [
      { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '' },
      { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: { redacted: true } },
      { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: '' } },
      { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: '' } },
      {
        type: 'message_update',
        id: 'm',
        event: {
          type: 'part',
          index: 0,
          part: {
            type: 'tool-invocation',
            toolInvocation: { toolCallId: 't', toolName: 'submit_plan', args: {}, state: 'result', result: 'approved' },
          },
        },
      },
    ];
    let state = initialChatRuntime;
    for (const event of events) state = runtimeReducer(state, { type: 'event', event });
    vi.setSystemTime(1010);
    state = runtimeReducer(state, {
      type: 'event',
      event: {
        type: 'usage_update',
        usage: { promptTokens: 100, completionTokens: 550, totalTokens: 650 },
      },
    });
    expect(state.tokensPerSec).toBe(0);
  });
  it('discards snapshot telemetry when resetting without a destination thread', () => {
    const reset = runtimeReducer(initialChatRuntime, {
      type: 'reset',
      state: { tokenUsage: { promptTokens: 21, completionTokens: 34, totalTokens: 55 } },
    });

    expect(reset.usage).toBeUndefined();
  });

  it.each(['bufferingMessages', 'bufferingObservations'] as const)(
    'tracks %s from display state, ahead of lifecycle start events',
    bufferingFlag => {
      const buffering = runtimeReducer(initialChatRuntime, {
        type: 'event',
        event: { type: 'display_state_changed', displayState: { [bufferingFlag]: true } },
      });
      const backgroundWork =
        bufferingFlag === 'bufferingMessages'
          ? { messages: 'background', observations: 'idle' }
          : { messages: 'idle', observations: 'background' };

      expect(omWork(buffering)).toEqual(backgroundWork);

      const started = runtimeReducer(buffering, {
        type: 'event',
        event: {
          type: bufferingFlag === 'bufferingMessages' ? 'om_observation_start' : 'om_reflection_start',
        },
      });

      expect(omWork(started)).toEqual(backgroundWork);

      for (const displayState of [{ [bufferingFlag]: false }, {}]) {
        const settled = runtimeReducer(buffering, {
          type: 'event',
          event: { type: 'display_state_changed', displayState },
        });

        expect(omWork(settled)).toEqual({ messages: 'idle', observations: 'idle' });
      }
    },
  );

  it('keeps buffering lifecycle events idle without a display-state buffering flag', () => {
    const buffering = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: { type: 'om_buffering_start' },
    });

    expect(omWork(buffering)).toEqual({ messages: 'idle', observations: 'idle' });
  });

  it('keeps display-state telemetry available until newer usage arrives', () => {
    const displayState = runtimeReducer(initialChatRuntime, {
      type: 'event',
      event: {
        type: 'display_state_changed',
        displayState: {
          omProgress: {
            status: 'idle',
            pendingTokens: 320,
            threshold: 1000,
            thresholdPercent: 32,
            observationTokens: 0,
            reflectionThreshold: 2000,
            reflectionThresholdPercent: 0,
            projectedMessageRemoval: 0,
            projectedReflectionSavings: 0,
          },
          tokenUsage: { promptTokens: 21, completionTokens: 34, totalTokens: 55 },
        },
      },
    });
    const updated = runtimeReducer(displayState, {
      type: 'event',
      event: { type: 'usage_update', usage: { promptTokens: 21, completionTokens: 55, totalTokens: 76 } },
    });

    expect(updated.omProgress?.pendingTokens).toBe(320);
    expect(updated.usage).toMatchObject({ completionTokens: 55, totalTokens: 76 });

    const partialSnapshot = runtimeReducer(updated, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: {} },
    });
    expect(partialSnapshot.usage).toEqual(updated.usage);
    expect(partialSnapshot.omProgress).toEqual(updated.omProgress);
  });

  it('measures generation across steps, retains the last rate, and clears it on reset or a new turn', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T15:00:00Z'));

    try {
      let state = initialChatRuntime;
      const emit = (event: AgentControllerEvent) => {
        state = runtimeReducer(state, { type: 'event', event });
      };
      const usage = { promptTokens: 10, completionTokens: 40, totalTokens: 50 };
      emit({ type: 'agent_start' });
      emit({
        type: 'message_start',
        message: {
          id: 'user-1',
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'Inspect this' }] },
        },
      });
      vi.advanceTimersByTime(1000);
      emit({
        type: 'message_start',
        message: {
          id: 'signal-1',
          role: 'signal',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'A reminder' }] },
        },
      });
      vi.advanceTimersByTime(1000);
      emit({
        type: 'message_start',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: new Date(),
          content: { format: 2, parts: [] },
        },
      });
      vi.advanceTimersByTime(1000);
      emit({
        type: 'message_update',
        id: 'assistant-1',
        event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' },
      } satisfies MessageUpdateEvent);
      vi.advanceTimersByTime(1000);
      emit({
        type: 'message_update',
        id: 'assistant-1',
        event: {
          type: 'part',
          index: 0,
          part: {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
          },
        },
      } satisfies MessageUpdateEvent);
      vi.advanceTimersByTime(1000);
      const assistantTextDelta: MessageUpdateEvent = {
        type: 'message_update',
        id: 'assistant-1',
        event: { type: 'text-delta', delta: 'Working' },
      };
      emit(assistantTextDelta);
      vi.advanceTimersByTime(1000);
      emit({ type: 'usage_update', usage });
      expect(state.tokensPerSec).toBe(20); // 40 total tokens / 2s from reasoning to final text

      emit({
        type: 'message_start',
        message: {
          id: 'signal-2',
          role: 'signal',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'A reminder' }] },
        },
      });
      vi.advanceTimersByTime(5000);
      emit(assistantTextDelta);
      vi.advanceTimersByTime(1000);
      emit(assistantTextDelta);
      vi.advanceTimersByTime(1000);
      emit({ type: 'usage_update', usage });
      expect(state.tokensPerSec).toBe(26);

      emit({ type: 'agent_end' });
      expect(state.tokensPerSec).toBe(26);
      emit(assistantTextDelta);
      state = runtimeReducer(state, { type: 'reset' });
      expect(state.tokensPerSec).toBe(0);
      emit({ type: 'usage_update', usage });
      expect(state.tokensPerSec).toBe(0);
      emit({ type: 'agent_start' });
      expect(state.tokensPerSec).toBe(0);
      emit({ type: 'usage_update', usage });
      expect(state.tokensPerSec).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
