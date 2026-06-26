import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../handlers/index.js', () => ({
  handleAgentStart: vi.fn(),
  handleAgentEnd: vi.fn(),
  handleAgentAborted: vi.fn(),
  handleAgentError: vi.fn(),
  handleGoalEvaluation: vi.fn(),
  handleMessageStart: vi.fn(),
  handleMessageUpdate: vi.fn(),
  handleMessageEnd: vi.fn(),
  handleOMObservationStart: vi.fn(),
  handleOMObservationEnd: vi.fn(),
  handleOMReflectionStart: vi.fn(),
  handleOMReflectionEnd: vi.fn(),
  handleOMFailed: vi.fn(),
  handleOMBufferingStart: vi.fn(),
  handleOMBufferingEnd: vi.fn(),
  handleOMBufferingFailed: vi.fn(),
  handleOMActivation: vi.fn(),
  handleOMThreadTitleUpdated: vi.fn(),
  handleAskQuestion: vi.fn(),
  handleSandboxAccessRequest: vi.fn(),
  handlePlanApproval: vi.fn(),
  handleSubagentStart: vi.fn(),
  handleSubagentToolStart: vi.fn(),
  handleSubagentToolEnd: vi.fn(),
  handleSubagentEnd: vi.fn(),
  handleToolApprovalRequired: vi.fn(),
  handleToolStart: vi.fn(),
  handleToolUpdate: vi.fn(),
  handleShellOutput: vi.fn(),
  handleToolInputStart: vi.fn(),
  handleToolInputDelta: vi.fn(),
  handleToolInputEnd: vi.fn(),
  handleToolEnd: vi.fn(),
}));

vi.mock('../state.js', () => ({
  getGithubPrSubscriptionsFromMetadata: vi.fn(() => []),
}));

vi.mock('../../utils/project.js', () => ({
  getCurrentGitBranchAsync: vi.fn(async () => 'main'),
}));

import { dispatchEvent } from '../event-dispatch.js';
import type { TUIState } from '../state.js';

function createMinimalState(overrides: Partial<TUIState> = {}): TUIState {
  return {
    prevCompletionTokens: 0,
    prevTokenTimestamp: 0,
    tokensPerSec: 0,
    taskToolInsertIndex: -1,
    activeGithubPrSubscriptions: [],
    ...overrides,
  } as unknown as TUIState;
}

function createEctx() {
  return {
    state: {},
    session: { displayState: { get: vi.fn(() => ({})) } },
    analytics: { trackInteractivePrompt: vi.fn() },
  } as any;
}

describe('tokens/sec EMA calculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('computes instantaneous rate on first usage_update pair', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // First event: sets baseline (no rate yet since prevTokenTimestamp is 0)
    vi.setSystemTime(1000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 50, totalTokens: 60 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(0);
    expect(state.prevCompletionTokens).toBe(10);
    expect(state.prevTokenTimestamp).toBe(1000);

    // Second event 1 second later: 20 tokens generated in 1s = 10 tok/s (instantaneous, first EMA)
    vi.setSystemTime(2000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 50, totalTokens: 70 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(10); // 10 tokens / 1 second
  });

  it('applies EMA smoothing on subsequent updates', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // Seed initial state
    vi.setSystemTime(1000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 0, totalTokens: 10 } } as any,
      ectx,
      state,
    );

    // Second event: 10 tok/s instantaneous (first EMA value)
    vi.setSystemTime(2000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 0, totalTokens: 20 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(10);

    // Third event: 20 tokens in 1s = 20 tok/s instantaneous
    // EMA = 0.3 * 20 + 0.7 * 10 = 6 + 7 = 13
    vi.setSystemTime(3000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 40, promptTokens: 0, totalTokens: 40 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(13);

    // Fourth event: 30 tokens in 1s = 30 tok/s instantaneous
    // EMA = 0.3 * 30 + 0.7 * 13 = 9 + 9.1 = 18.1 → rounds to 18
    vi.setSystemTime(4000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 70, promptTokens: 0, totalTokens: 70 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(18);
  });

  it('resets tokensPerSec to 0 on agent_end', async () => {
    const state = createMinimalState({ tokensPerSec: 42, prevTokenTimestamp: 1000 });
    const ectx = createEctx();

    await dispatchEvent({ type: 'agent_end', reason: 'done' } as any, ectx, state);

    expect(state.tokensPerSec).toBe(0);
    expect(state.prevTokenTimestamp).toBe(0);
  });

  it('does not compute rate when completionTokens has not increased', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    vi.setSystemTime(1000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 0, totalTokens: 10 } } as any,
      ectx,
      state,
    );

    // Same token count — no rate change
    vi.setSystemTime(2000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 20, totalTokens: 30 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(0);
  });
});
