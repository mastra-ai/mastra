import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    decodeStartedAt: 0,
    tokensPerSec: 0,
    taskToolInsertIndex: -1,
    activeGithubPrSubscriptions: [],
    ui: { requestRender: vi.fn() },
    ...overrides,
  } as unknown as TUIState;
}

function createEctx() {
  return {
    state: {},
    session: { displayState: { get: vi.fn(() => ({})) } },
    analytics: { trackInteractivePrompt: vi.fn() },
    updateStatusLine: vi.fn(),
  } as any;
}

/**
 * Drives one decode step: a message_update opens the decode window at `startMs`,
 * then a usage_update closes it at `endMs` carrying the step's tokens. This
 * mirrors the real event order (deltas stream, then step-finish reports usage)
 * so tokens/sec is measured over decode time only.
 */
async function decodeStep(
  state: TUIState,
  ectx: ReturnType<typeof createEctx>,
  opts: { startMs: number; endMs: number; completionTokens: number; reasoningTokens?: number },
): Promise<void> {
  vi.setSystemTime(opts.startMs);
  await dispatchEvent(
    {
      type: 'message_update',
      message: { role: 'assistant', content: [{ type: 'text', text: 'streaming...' }] },
    } as any,
    ectx,
    state,
  );
  vi.setSystemTime(opts.endMs);
  await dispatchEvent(
    {
      type: 'usage_update',
      usage: {
        completionTokens: opts.completionTokens,
        reasoningTokens: opts.reasoningTokens,
        promptTokens: 0,
        totalTokens: opts.completionTokens,
      },
    } as any,
    ectx,
    state,
  );
}

describe('tokens/sec decode-window calculation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes rate over decode time, excluding pre-decode (TTFT) time', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // Decode opened at t=1000, step-finish at t=2000 → 1s of decode for 20 tokens.
    await decodeStep(state, ectx, { startMs: 1000, endMs: 2000, completionTokens: 20 });

    expect(state.tokensPerSec).toBe(20); // 20 tokens / 1 second decode
    // Window re-arms after step-finish so the next step measures fresh.
    expect(state.decodeStartedAt).toBe(0);
    // Status line repaints and a coordinated render is requested so the prior
    // frame is cleared (otherwise stale "tok/s" text ghosts on screen).
    expect(ectx.updateStatusLine).toHaveBeenCalled();
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('ignores TTFT/tool gap before the first delta', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // Even though usage arrives at t=5000, decoding only began at t=4000, so
    // 20 tokens over 1s = 20 tok/s — not 20 / 4s.
    vi.setSystemTime(1000); // request issued; nothing streamed yet
    vi.setSystemTime(4000);
    await dispatchEvent(
      { type: 'message_update', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } } as any,
      ectx,
      state,
    );
    vi.setSystemTime(5000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 0, totalTokens: 20 } } as any,
      ectx,
      state,
    );

    expect(state.tokensPerSec).toBe(20);
  });

  it('records stream activity on assistant message updates', async () => {
    const state = createMinimalState({ agentRunStartedAt: 1000, agentRunLastStreamPartAt: 1000 });
    const ectx = createEctx();

    vi.setSystemTime(4000);
    await dispatchEvent(
      {
        type: 'message_update',
        message: { role: 'assistant', content: [{ type: 'text', text: 'streaming...' }] },
      } as any,
      ectx,
      state,
    );

    expect(state.agentRunLastStreamPartAt).toBe(4000);
    expect(state.decodeStartedAt).toBe(4000);
    expect(ectx.updateStatusLine).toHaveBeenCalled();
  });

  it('does not open the decode window for non-assistant text updates', async () => {
    const state = createMinimalState({ agentRunStartedAt: 1000, agentRunLastStreamPartAt: 1000 });
    const ectx = createEctx();

    vi.setSystemTime(4000);
    await dispatchEvent(
      { type: 'message_update', message: { role: 'user', content: [{ type: 'text', text: 'user text' }] } } as any,
      ectx,
      state,
    );

    expect(state.agentRunLastStreamPartAt).toBe(1000);
    expect(state.decodeStartedAt).toBe(0);
    expect(ectx.updateStatusLine).toHaveBeenCalled();
  });

  it('records tool and shell activity without opening the decode window', async () => {
    const state = createMinimalState({ agentRunStartedAt: 1000, agentRunLastStreamPartAt: 1000 });
    const ectx = createEctx();

    vi.setSystemTime(4000);
    await dispatchEvent(
      { type: 'tool_update', toolCallId: 'tool-1', partialResult: { status: 'working' } } as any,
      ectx,
      state,
    );
    expect(state.agentRunLastStreamPartAt).toBe(4000);
    expect(state.decodeStartedAt).toBe(0);

    vi.setSystemTime(5000);
    await dispatchEvent({ type: 'shell_output', toolCallId: 'tool-1', output: 'still working' } as any, ectx, state);
    expect(state.agentRunLastStreamPartAt).toBe(5000);
    expect(state.decodeStartedAt).toBe(0);
  });

  it('includes reasoning tokens in the decode rate', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // 10 completion + 10 reasoning = 20 tokens over 1s decode = 20 tok/s.
    await decodeStep(state, ectx, { startMs: 1000, endMs: 2000, completionTokens: 10, reasoningTokens: 10 });

    expect(state.tokensPerSec).toBe(20);
  });

  it('applies EMA smoothing across decode steps', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // Step 1: 10 tokens / 1s = 10 tok/s (first EMA value).
    await decodeStep(state, ectx, { startMs: 1000, endMs: 2000, completionTokens: 10 });
    expect(state.tokensPerSec).toBe(10);

    // Step 2: 20 tokens / 1s = 20 instantaneous. EMA = 0.3*20 + 0.7*10 = 13.
    await decodeStep(state, ectx, { startMs: 3000, endMs: 4000, completionTokens: 20 });
    expect(state.tokensPerSec).toBe(13);

    // Step 3: 30 tokens / 1s = 30 instantaneous. EMA = 0.3*30 + 0.7*13 = 18.1 → 18.
    await decodeStep(state, ectx, { startMs: 5000, endMs: 6000, completionTokens: 30 });
    expect(state.tokensPerSec).toBe(18);
  });

  it('keeps the last rate after agent_end and clears it on the next agent_start', async () => {
    const state = createMinimalState({ tokensPerSec: 42, decodeStartedAt: 1000 });
    const ectx = createEctx();

    vi.setSystemTime(1000);
    await dispatchEvent({ type: 'agent_start' } as any, ectx, state);
    expect(state.tokensPerSec).toBe(0);
    expect(state.decodeStartedAt).toBe(0);
    expect(state.agentRunStartedAt).toBe(1000);
    expect(state.agentRunLastStreamPartAt).toBe(1000);
    expect(state.lastAgentRunDurationMs).toBeUndefined();
    expect(state.lastAgentRunEndedAt).toBeUndefined();
    expect(state.lastAgentRunEndReason).toBeUndefined();

    state.tokensPerSec = 42;
    state.decodeStartedAt = 1500;

    // agent_end keeps the reading visible (so short turns stay readable) but
    // clears the in-flight decode window.
    vi.setSystemTime(4000);
    await dispatchEvent({ type: 'agent_end', reason: 'done' } as any, ectx, state);
    expect(state.tokensPerSec).toBe(42);
    expect(state.decodeStartedAt).toBe(0);
    expect(state.agentRunStartedAt).toBeUndefined();
    expect(state.agentRunLastStreamPartAt).toBeUndefined();
    expect(state.lastAgentRunDurationMs).toBe(3000);
    expect(state.lastAgentRunEndedAt).toBe(4000);
    expect(state.lastAgentRunEndReason).toBe('done');

    // The next turn's agent_start clears it for a fresh measurement.
    vi.setSystemTime(5000);
    await dispatchEvent({ type: 'agent_start' } as any, ectx, state);
    expect(state.tokensPerSec).toBe(0);
    expect(state.decodeStartedAt).toBe(0);
    expect(state.agentRunStartedAt).toBe(5000);
    expect(state.lastAgentRunDurationMs).toBeUndefined();
    expect(state.lastAgentRunEndedAt).toBeUndefined();
  });

  it('does not compute a rate for a tool-only step with no streamed content', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // No message_update means decoding never opened a window for this step; a
    // usage_update with 0 completion tokens (pure tool call) must not produce a rate.
    vi.setSystemTime(2000);
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 0, promptTokens: 20, totalTokens: 20 } } as any,
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(0);
  });

  it('does not spike tok/s when message_update carries only tool-result content (plan approval resume)', async () => {
    const state = createMinimalState();
    const ectx = createEctx();

    // Simulate plan approval resume: agent_start resets state, then a
    // message_update fires carrying only a tool-result (submit_plan result)
    // with NO text content. The decode window should NOT open for this because
    // no actual LLM text is being streamed yet.
    vi.setSystemTime(10_000);
    await dispatchEvent({ type: 'agent_start' } as any, ectx, state);
    expect(state.tokensPerSec).toBe(0);
    expect(state.decodeStartedAt).toBe(0);

    // message_update with tool-result only (no text content) — this is what
    // fires when the plan tool's result is delivered back to the model.
    vi.setSystemTime(10_010);
    await dispatchEvent(
      {
        type: 'message_update',
        message: {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: 'tc_1', toolName: 'submit_plan', args: {} }],
        },
      } as any,
      ectx,
      state,
    );

    // The decode window should NOT have opened — there's no streamed text.
    expect(state.decodeStartedAt).toBe(0);

    // Now usage_update arrives 10ms later with the token count from the
    // original plan-generation step. If the decode window was incorrectly
    // opened, this would compute 550 / 0.01 = 55,000 tok/s — the exact
    // spike observed in the bug report.
    vi.setSystemTime(10_020);
    await dispatchEvent(
      {
        type: 'usage_update',
        usage: { completionTokens: 550, reasoningTokens: 0, promptTokens: 200, totalTokens: 750 },
      } as any,
      ectx,
      state,
    );

    // With the decode window never opened, tok/s should remain 0 — NOT 55,000.
    expect(state.tokensPerSec).toBe(0);
  });

  it('records aborted and error end reasons for run summaries', async () => {
    const ectx = createEctx();

    vi.setSystemTime(1000);
    const abortedState = createMinimalState({ agentRunStartedAt: 1000 });
    vi.setSystemTime(4000);
    await dispatchEvent({ type: 'agent_end', reason: 'aborted' } as any, ectx, abortedState);
    expect(abortedState.lastAgentRunDurationMs).toBe(3000);
    expect(abortedState.lastAgentRunEndReason).toBe('aborted');

    vi.setSystemTime(5000);
    const errorState = createMinimalState({ agentRunStartedAt: 5000 });
    vi.setSystemTime(9000);
    await dispatchEvent({ type: 'agent_end', reason: 'error' } as any, ectx, errorState);
    expect(errorState.lastAgentRunDurationMs).toBe(4000);
    expect(errorState.lastAgentRunEndReason).toBe('error');
  });
});
