import { describe, expect, it, vi } from 'vitest';

import { initialChatRuntime, runtimeReducer } from '../runtime';

describe('chat runtime reducer', () => {
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

  it('measures a streamed assistant decode window and tracks active runtime work', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T15:00:00Z'));

    const streaming = runtimeReducer(initialChatRuntime, {
      type: 'message_update',
      message: {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
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
