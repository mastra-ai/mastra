import type { AgentControllerEvent } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { omWork } from '../om';
import { initialChatRuntime, runtimeReducer } from '../runtime';

function dbMessage(id: string, role: MastraDBMessage['role'], parts: MastraMessagePart[]): MastraDBMessage {
  return { id, role, createdAt: new Date(), content: { format: 2, parts } };
}

describe('chat runtime status', () => {
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

  it('measures decode time across steps without counting tool gaps or signal messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T15:00:00Z'));

    try {
      let state = initialChatRuntime;
      const emit = (event: AgentControllerEvent) => {
        state = runtimeReducer(state, { type: 'event', event });
      };
      const usage = { promptTokens: 10, completionTokens: 40, reasoningTokens: 2, totalTokens: 52 };
      emit({ type: 'agent_start' });
      for (const message of [
        dbMessage('user-1', 'user', [{ type: 'text', text: 'Inspect this' }]),
        dbMessage('signal-1', 'signal', [{ type: 'text', text: 'A reminder' }]),
        dbMessage('assistant-1', 'assistant', []),
        dbMessage('assistant-1', 'assistant', [{ type: 'text', text: ' ' }]),
        dbMessage('assistant-1', 'assistant', [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'tool-1', toolName: 'view', args: {} },
          },
        ]),
      ]) {
        emit({ type: 'message_update', message });
        vi.advanceTimersByTime(1000);
      }
      const assistant = dbMessage('assistant-1', 'assistant', [{ type: 'text', text: 'Working' }]);
      emit({ type: 'message_update', message: assistant });
      vi.advanceTimersByTime(1000);
      emit({ type: 'usage_update', usage });
      expect(state.tokensPerSec).toBe(42);

      emit({ type: 'message_start', message: dbMessage('signal-2', 'signal', [{ type: 'text', text: 'A reminder' }]) });
      vi.advanceTimersByTime(5000);
      emit({ type: 'message_update', message: assistant });
      vi.advanceTimersByTime(1000);
      emit({ type: 'message_update', message: assistant });
      vi.advanceTimersByTime(1000);
      emit({ type: 'usage_update', usage });
      expect(state.tokensPerSec).toBe(36);

      emit({ type: 'agent_end' });
      expect(state.tokensPerSec).toBe(36);
      emit({ type: 'message_update', message: assistant });
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
