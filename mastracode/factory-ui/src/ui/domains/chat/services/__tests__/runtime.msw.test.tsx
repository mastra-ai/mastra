import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatRuntimeState } from '../runtime';
import { initialChatRuntime, omWork, runtimeReducer } from '../runtime';

describe('chat runtime reducer', () => {
  it('tracks background memory work per budget from the display state', () => {
    const buffering = runtimeReducer(initialChatRuntime, {
      type: 'display_state_changed',
      displayState: { bufferingObservations: true },
    });

    expect(omWork(buffering)).toEqual({ messages: 'idle', observations: 'background' });

    const settled = runtimeReducer(buffering, {
      type: 'display_state_changed',
      displayState: { bufferingObservations: false },
    });

    expect(omWork(settled).observations).toBe('idle');
  });

  it('keeps display-state telemetry available until newer usage arrives', () => {
    const displayState = runtimeReducer(initialChatRuntime, {
      type: 'display_state_changed',
      displayState: {
        omProgress: {
          status: 'ready',
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
    });

    const updated = runtimeReducer(displayState, {
      type: 'usage_update',
      usage: { promptTokens: 21, completionTokens: 55, totalTokens: 76 },
    });

    expect(updated.omProgress?.pendingTokens).toBe(320);
    expect(updated.usage).toMatchObject({ completionTokens: 55, totalTokens: 76 });
  });

  describe('throughput', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-10T15:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('measures decode speed on the streamed text and tracks active runtime work', () => {
      const opened = streamText(runtimeReducer(initialChatRuntime, { type: 'agent_start' }), 'x'.repeat(20));
      vi.advanceTimersByTime(1000);
      const measured = streamText(opened, 'x'.repeat(220));
      const observing = runtimeReducer(measured, { type: 'om_observation_start' });
      const queued = runtimeReducer(observing, { type: 'follow_up_queued', count: 2 });

      expect(queued.tokensPerSec).toBe(50);
      expect(queued.tokensPerSecHistory).toEqual([50]);
      expect(queued.omPhase).toBe('observing');
      expect(queued.followUpCount).toBe(2);
    });

    it('holds a chunk too short to time instead of dividing it by a millisecond', () => {
      const opened = streamText(runtimeReducer(initialChatRuntime, { type: 'agent_start' }), 'x'.repeat(20));
      vi.advanceTimersByTime(5);
      const burst = streamText(opened, 'x'.repeat(7000));

      expect(burst.tokensPerSec).toBe(0);
      expect(burst.tokensPerSecHistory).toEqual([]);
    });

    it('counts thinking as decoding, so a long reasoning pass still reads as speed', () => {
      const opened = runtimeReducer(runtimeReducer(initialChatRuntime, { type: 'agent_start' }), {
        type: 'message_update',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'reasoning', reasoning: 'x'.repeat(20), details: [] }] },
        },
      });
      vi.advanceTimersByTime(1000);
      const thinking = runtimeReducer(opened, {
        type: 'message_update',
        message: {
          id: 'assistant-1',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'reasoning', reasoning: 'x'.repeat(220), details: [] }] },
        },
      });

      expect(thinking.tokensPerSec).toBe(50);
    });

    it('measures a run it joined mid-flight, without waiting for the next one', () => {
      const opened = streamText(initialChatRuntime, 'x'.repeat(20));
      vi.advanceTimersByTime(1000);

      expect(streamText(opened, 'x'.repeat(220)).tokensPerSec).toBe(50);
    });

    it('keeps counting across the messages of one run instead of restarting on each', () => {
      const opened = streamText(runtimeReducer(initialChatRuntime, { type: 'agent_start' }), 'x'.repeat(400));
      vi.advanceTimersByTime(1000);
      const second = streamText(opened, 'x'.repeat(600), 'assistant-2');

      expect(second.tokensPerSec).toBe(150);
    });

    it('reopens the window after a tool call rather than averaging over the pause', () => {
      const opened = streamText(runtimeReducer(initialChatRuntime, { type: 'agent_start' }), 'x'.repeat(20));
      vi.advanceTimersByTime(30_000);
      const afterTool = streamText(opened, 'x'.repeat(220));

      expect(afterTool.tokensPerSec).toBe(0);

      vi.advanceTimersByTime(1000);

      expect(streamText(afterTool, 'x'.repeat(420)).tokensPerSec).toBe(50);
    });
  });
});

function streamText(state: ChatRuntimeState, text: string, id = 'assistant-1'): ChatRuntimeState {
  return runtimeReducer(state, {
    type: 'message_update',
    message: {
      id,
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text }] },
    },
  });
}
