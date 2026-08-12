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

    it('drops the reading when the run ends, so an idle composer shows no throughput', () => {
      const opened = streamText(runtimeReducer(initialChatRuntime, { type: 'agent_start' }), 'x'.repeat(20));
      vi.advanceTimersByTime(1000);
      const measured = streamText(opened, 'x'.repeat(220));
      const ended = runtimeReducer(measured, { type: 'agent_end' });

      expect(ended.tokensPerSec).toBe(0);
      expect(ended.tokensPerSecHistory).toEqual([]);
      expect(streamText(ended, 'x'.repeat(9000)).tokensPerSec).toBe(0);
    });
  });
});

function streamText(state: ChatRuntimeState, text: string): ChatRuntimeState {
  return runtimeReducer(state, {
    type: 'message_update',
    message: {
      id: 'assistant-1',
      role: 'assistant',
      content: { format: 2, parts: [{ type: 'text', text }] },
    },
  });
}
