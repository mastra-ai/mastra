import { defaultOMProgressState } from '@mastra/core/agent-controller';
import type { OMProgressState } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

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
    const omProgress: OMProgressState = {
      ...defaultOMProgressState(),
      pendingTokens: 320,
      threshold: 1000,
      thresholdPercent: 32,
      observationTokens: 900,
      reflectionThreshold: 2000,
      reflectionThresholdPercent: 45,
      buffered: {
        observations: {
          status: 'running',
          chunks: 1,
          messageTokens: 260,
          projectedMessageRemoval: 120,
          observationTokens: 40,
        },
        reflection: { status: 'running', inputObservationTokens: 900, observationTokens: 300 },
      },
    };

    const displayState = runtimeReducer(initialChatRuntime, {
      type: 'display_state_changed',
      displayState: {
        omProgress,
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

  // The stream carries the full progress state; only the session-state route sends the
  // flat one. Reading the pending pass off the wrong shape is how it went missing before.
  it('keeps a pending pass readable off the streamed progress state', () => {
    const streamed = runtimeReducer(initialChatRuntime, {
      type: 'display_state_changed',
      displayState: {
        omProgress: {
          ...defaultOMProgressState(),
          buffered: {
            observations: {
              status: 'running',
              chunks: 2,
              messageTokens: 8_000,
              projectedMessageRemoval: 7_400,
              observationTokens: 600,
            },
            reflection: { status: 'running', inputObservationTokens: 9_000, observationTokens: 2_500 },
          },
        },
      },
    });

    expect(streamed.omProgress?.projectedMessageRemoval).toBe(7_400);
    expect(streamed.omProgress?.projectedReflectionSavings).toBe(6_500);
  });

  it('measures a streamed assistant decode window and tracks active runtime work', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T15:00:00Z'));

    const streaming = runtimeReducer(initialChatRuntime, {
      type: 'message_update',
      message: {
        id: 'assistant-1',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Working' }] },
      },
    });
    vi.advanceTimersByTime(1000);
    const measured = runtimeReducer(streaming, {
      type: 'usage_update',
      usage: { completionTokens: 42, totalTokens: 42 },
    });
    const observing = runtimeReducer(measured, { type: 'om_observation_start' });
    const queued = runtimeReducer(observing, { type: 'follow_up_queued', count: 2 });

    expect(queued.tokensPerSec).toBe(42);
    expect(queued.omPhase).toBe('observing');
    expect(queued.followUpCount).toBe(2);

    vi.useRealTimers();
  });

  it('accepts persisted messages whose content uses the format-2 parts envelope', () => {
    const event = {
      type: 'message_update',
      message: {
        id: 'assistant-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Working' }] },
      },
    } as Parameters<typeof runtimeReducer>[1];

    expect(runtimeReducer(initialChatRuntime, event)._decodeStartedAt).toBeGreaterThan(0);
  });
});
