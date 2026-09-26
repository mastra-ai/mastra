import type { AgentControllerEvent } from '@mastra/core/agent-controller';
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
  clearPendingShellOutputs: vi.fn(),
  clearToolInputParsers: vi.fn(),
}));

vi.mock('../state.js', () => ({ getGithubPrSubscriptionsFromMetadata: vi.fn(() => []) }));
vi.mock('@mastra/code-sdk/utils/project', () => ({ getCurrentGitBranchAsync: vi.fn(async () => 'main') }));

import { dispatchEvent } from '../event-dispatch.js';
import * as handlers from '../handlers/index.js';
import type { TUIState } from '../state.js';

function createMinimalState(overrides: Partial<TUIState> = {}): TUIState {
  return {
    tokensPerSec: 0,
    decodeMessageId: undefined,
    decodeStartedAt: 0,
    decodeLastDeltaAt: 0,
    decodeHasReasoning: false,
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

function usageEvent(completionTokens: number): AgentControllerEvent {
  return {
    type: 'usage_update',
    usage: { completionTokens, promptTokens: 100, totalTokens: 100 + completionTokens },
  };
}

async function decodeStep(
  state: TUIState,
  ectx: ReturnType<typeof createEctx>,
  completionTokens: number,
  startMs = 1000,
  endMs = 2000,
) {
  state.streamingMessage = {
    id: 'm',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text: '' }] },
  };
  for (const at of [startMs, endMs]) {
    vi.setSystemTime(at);
    await dispatchEvent(
      { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Output' } },
      ectx,
      state,
    );
  }
  // Tool execution and delayed usage must not extend the decode interval.
  vi.setSystemTime(endMs + 30_000);
  await dispatchEvent(usageEvent(completionTokens), ectx, state);
}

describe('tokens/sec over streamed generation time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('excludes initial wait and delayed usage, and repaints the status line', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    vi.setSystemTime(1000);
    await dispatchEvent({ type: 'agent_start' }, ectx, state);
    await decodeStep(state, ectx, 40, 4000, 5000);
    expect(state.tokensPerSec).toBe(40);
    expect(ectx.updateStatusLine).toHaveBeenCalled();
    expect(state.ui.requestRender).toHaveBeenCalled();
    expect(state.decodeStartedAt).toBe(0);
    expect(state.decodeLastDeltaAt).toBe(0);
  });

  it('allows the captured 170-token / 13ms tool-argument burst without including tool execution', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    vi.setSystemTime(3600);
    await dispatchEvent({ type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{' }, ectx, state);
    vi.setSystemTime(3613);
    await dispatchEvent({ type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '}' }, ectx, state);
    vi.setSystemTime(60_000);
    await dispatchEvent({ type: 'tool_update', toolCallId: 't', partialResult: 'done' }, ectx, state);
    await dispatchEvent(usageEvent(170), ectx, state);
    expect(state.tokensPerSec).toBe(13077);
  });

  it.each([2400, undefined])(
    'includes streamed thinking and counts output once (reasoning usage: %s)',
    async reasoningTokens => {
      const state = createMinimalState({
        streamingMessage: {
          id: 'm',
          role: 'assistant',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              { type: 'reasoning', reasoning: '', details: [] },
              { type: 'text', text: '' },
            ],
          },
        },
      });
      const ectx = createEctx();
      vi.setSystemTime(1000);
      await dispatchEvent(
        { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } },
        ectx,
        state,
      );
      for (const at of [61_000, 62_000]) {
        vi.setSystemTime(at);
        await dispatchEvent(
          { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } },
          ectx,
          state,
        );
      }
      vi.setSystemTime(90_000);
      await dispatchEvent(
        {
          type: 'usage_update',
          usage: { completionTokens: 2440, reasoningTokens, promptTokens: 100, totalTokens: 2540 },
        },
        ectx,
        state,
      );
      expect(state.tokensPerSec).toBe(40);
      expect(state.decodeHasReasoning).toBe(false);
      await decodeStep(state, ectx, 40, 91_000, 92_000);
      expect(state.tokensPerSec).toBe(40);
    },
  );

  it('measures reasoning-only generation', async () => {
    const state = createMinimalState({
      streamingMessage: {
        id: 'm',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'reasoning', reasoning: '', details: [] },
            { type: 'text', text: '' },
          ],
        },
      },
    });
    const ectx = createEctx();
    for (const at of [1000, 2000]) {
      vi.setSystemTime(at);
      await dispatchEvent(
        { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } },
        ectx,
        state,
      );
    }
    await dispatchEvent(
      {
        type: 'usage_update',
        usage: { completionTokens: 40, reasoningTokens: 40, promptTokens: 100, totalTokens: 140 },
      },
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(40);
  });

  it('counts thinking that starts after text in the same step', async () => {
    // Text opens the window before any thinking streams. The thinking that follows still
    // happened inside it, so usage_update must not subtract those tokens as unmeasured.
    const state = createMinimalState({
      streamingMessage: {
        id: 'm',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'reasoning', reasoning: '', details: [] },
            { type: 'text', text: '' },
          ],
        },
      },
    });
    const ectx = createEctx();
    vi.setSystemTime(1000);
    await dispatchEvent(
      { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } },
      ectx,
      state,
    );
    expect(state.decodeHasReasoning).toBe(false);
    vi.setSystemTime(2000);
    await dispatchEvent(
      { type: 'message_update', id: 'm', event: { type: 'reasoning-delta', index: 0, delta: 'Thinking' } },
      ectx,
      state,
    );
    expect(state.decodeHasReasoning).toBe(true);
    vi.setSystemTime(90_000);
    await dispatchEvent(
      {
        type: 'usage_update',
        usage: { completionTokens: 40, reasoningTokens: 40, promptTokens: 100, totalTokens: 140 },
      },
      ectx,
      state,
    );
    expect(state.tokensPerSec).toBe(40);
  });

  it('preserves the last rate for an unmeasurable single-batch response', async () => {
    const state = createMinimalState({ tokensPerSec: 40 });
    await decodeStep(state, createEctx(), 5000, 1000, 1000);
    expect(state.tokensPerSec).toBe(40);
  });

  it('measures the visible output when reasoning tokens never streamed', async () => {
    // 2440 output tokens of which 2400 are thinking that never streamed: only the
    // 40 visible tokens can be timed. Prior 10 → EMA = 0.3*40 + 0.7*10 = 19.
    const state = createMinimalState({ tokensPerSec: 10, decodeStartedAt: 1000, decodeLastDeltaAt: 2000 });
    await dispatchEvent(
      {
        type: 'usage_update',
        usage: { completionTokens: 2440, reasoningTokens: 2400, promptTokens: 100, totalTokens: 2540 },
      },
      createEctx(),
      state,
    );
    expect(state.tokensPerSec).toBe(19);
    expect(state.decodeStartedAt).toBe(0);
  });

  it('ignores empty and transformed tool-input deltas', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    await dispatchEvent({ type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '' }, ectx, state);
    await dispatchEvent({ type: 'tool_input_delta', toolCallId: 't', argsTextDelta: { redacted: true } }, ectx, state);
    expect(state.decodeStartedAt).toBe(0);
    expect(state.decodeLastDeltaAt).toBe(0);
  });

  it('does not carry the decode window into the next step when a step reported no usage', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    const stream = (id: string, at: number, delta: string) => {
      state.streamingMessage = {
        id,
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: '' }] },
      };
      vi.setSystemTime(at);
      return dispatchEvent({ type: 'message_update', id, event: { type: 'text-delta', delta } }, ectx, state);
    };

    // Step 1 streams, then never reports usage. Step 2 is a different assistant message:
    // its 40 tokens must be timed over its own 1s, not the 29s window step 1 left open.
    await stream('step-1', 1000, 'One');
    await stream('step-2', 30_000, 'Two');
    await stream('step-2', 31_000, ' continues');
    vi.setSystemTime(60_000);
    await dispatchEvent(usageEvent(40), ectx, state);
    expect(state.tokensPerSec).toBe(40);
  });

  it.each([
    ['text', [{ type: 'text', text: '' }], { type: 'text-delta', delta: 'One' }],
    [
      'reasoning',
      [{ type: 'reasoning', reasoning: '', details: [] }],
      { type: 'reasoning-delta', index: 0, delta: 'Thinking' },
    ],
  ] as const)(
    'does not leak a usage-less %s step into a step whose first output is tool arguments',
    async (_label, parts, firstDelta) => {
      const state = createMinimalState();
      const ectx = createEctx();
      state.streamingMessage = {
        id: 'step-1',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [...parts] },
      };
      vi.setSystemTime(1000);
      await dispatchEvent({ type: 'message_update', id: 'step-1', event: { ...firstDelta } }, ectx, state);
      expect(state.decodeStartedAt).toBe(1000);

      // Step 2 streams tool arguments before its message_start and never reports usage for
      // step 1, so the args must rebind the window to step 2 rather than extend step 1's.
      vi.setSystemTime(30_000);
      await dispatchEvent(
        { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{"path"', messageId: 'step-2' },
        ectx,
        state,
      );
      vi.setSystemTime(31_000);
      await dispatchEvent(
        { type: 'tool_input_delta', toolCallId: 't', argsTextDelta: ':"a.ts"}', messageId: 'step-2' },
        ectx,
        state,
      );
      vi.setSystemTime(60_000);
      await dispatchEvent(usageEvent(40), ectx, state);
      expect(state.tokensPerSec).toBe(40);
    },
  );

  it('rebinds the window between two argument-only steps', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    for (const [at, messageId] of [
      [1000, 'step-1'],
      [2000, 'step-1'],
      [30_000, 'step-2'],
      [31_000, 'step-2'],
    ] as const) {
      vi.setSystemTime(at);
      await dispatchEvent({ type: 'tool_input_delta', toolCallId: 't', argsTextDelta: '{', messageId }, ectx, state);
    }
    vi.setSystemTime(60_000);
    await dispatchEvent(usageEvent(40), ectx, state);
    expect(state.tokensPerSec).toBe(40);
  });

  it('still measures a step whose message closed before its usage arrived', async () => {
    // The goal path closes the assistant message before the step's step-finish, so
    // message_end lands first. The pending usage must still measure that step.
    const state = createMinimalState({
      streamingMessage: {
        id: 'm',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: '' }] },
      },
    });
    const ectx = createEctx();
    for (const at of [1000, 2000]) {
      vi.setSystemTime(at);
      await dispatchEvent(
        { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Answer' } },
        ectx,
        state,
      );
    }
    await dispatchEvent({ type: 'message_end', id: 'm' }, ectx, state);
    vi.setSystemTime(60_000);
    await dispatchEvent(usageEvent(40), ectx, state);
    expect(state.tokensPerSec).toBe(40);
  });

  it('does not cap legitimate fast model output', async () => {
    const state = createMinimalState();
    await decodeStep(state, createEctx(), 1200, 1000, 3000);
    expect(state.tokensPerSec).toBe(600);
  });

  it('applies EMA smoothing across model steps', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    await decodeStep(state, ectx, 10, 1000, 2000);
    expect(state.tokensPerSec).toBe(10);
    await decodeStep(state, ectx, 20, 40_000, 41_000);
    expect(state.tokensPerSec).toBe(13);
    await decodeStep(state, ectx, 30, 80_000, 81_000);
    expect(state.tokensPerSec).toBe(18);
  });

  it('keeps the latest request prompt tokens separate from cumulative usage', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 10, promptTokens: 50_000, totalTokens: 50_010 } },
      ectx,
      state,
    );
    await dispatchEvent(
      { type: 'usage_update', usage: { completionTokens: 20, promptTokens: 90_000, totalTokens: 90_020 } },
      ectx,
      state,
    );
    expect(state.latestRequestPromptTokens).toBe(90_000);
  });

  it('records stream activity on assistant message updates', async () => {
    const state = createMinimalState({
      agentRunStartedAt: 1000,
      agentRunLastStreamPartAt: 1000,
      streamingMessage: {
        id: 'm',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: '' }] },
      },
    });
    const ectx = createEctx();
    vi.setSystemTime(4000);
    await dispatchEvent(
      { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Hello' } },
      ectx,
      state,
    );
    expect(state.agentRunLastStreamPartAt).toBe(4000);
    expect(ectx.updateStatusLine).toHaveBeenCalled();
  });

  it('does not count non-assistant text as stream activity', async () => {
    const state = createMinimalState({
      agentRunStartedAt: 1000,
      agentRunLastStreamPartAt: 1000,
      streamingMessage: {
        id: 'm',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: '' }] },
      },
    });
    const ectx = createEctx();
    vi.setSystemTime(4000);
    await dispatchEvent(
      { type: 'message_update', id: 'm', event: { type: 'text-delta', delta: 'Hello' } },
      ectx,
      state,
    );
    expect(state.agentRunLastStreamPartAt).toBe(1000);
    expect(ectx.updateStatusLine).not.toHaveBeenCalled();
  });

  it('records tool and shell activity without changing throughput', async () => {
    const state = createMinimalState({ agentRunStartedAt: 1000, tokensPerSec: 40 });
    const ectx = createEctx();
    vi.setSystemTime(4000);
    await dispatchEvent({ type: 'tool_update', toolCallId: 't', partialResult: 'working' }, ectx, state);
    expect(state.agentRunLastStreamPartAt).toBe(4000);
    vi.setSystemTime(5000);
    await dispatchEvent({ type: 'shell_output', toolCallId: 't', output: 'working', stream: 'stdout' }, ectx, state);
    expect(state.agentRunLastStreamPartAt).toBe(5000);
    expect(state.tokensPerSec).toBe(40);
  });

  it('clears pending shell output timers on agent_start and terminal abort/error ends', async () => {
    const state = createMinimalState();
    const ectx = createEctx();
    await dispatchEvent({ type: 'agent_start' }, ectx, state);
    expect(handlers.clearPendingShellOutputs).toHaveBeenCalledTimes(1);
    await dispatchEvent({ type: 'agent_end', reason: 'aborted' }, ectx, state);
    expect(handlers.clearPendingShellOutputs).toHaveBeenCalledTimes(2);
    await dispatchEvent({ type: 'agent_end', reason: 'error' }, ectx, state);
    expect(handlers.clearPendingShellOutputs).toHaveBeenCalledTimes(3);
    await dispatchEvent({ type: 'agent_end', reason: 'done' }, ectx, state);
    expect(handlers.clearPendingShellOutputs).toHaveBeenCalledTimes(3);
  });

  it('keeps the last rate after agent_end and clears it on the next agent_start', async () => {
    const state = createMinimalState({ tokensPerSec: 42 });
    const ectx = createEctx();
    vi.setSystemTime(1000);
    await dispatchEvent({ type: 'agent_start' }, ectx, state);
    expect(state.tokensPerSec).toBe(0);
    expect(state.agentRunStartedAt).toBe(1000);
    expect(state.agentRunLastStreamPartAt).toBe(1000);
    expect(state.lastAgentRunDurationMs).toBeUndefined();
    expect(state.lastAgentRunEndedAt).toBeUndefined();
    expect(state.lastAgentRunEndReason).toBeUndefined();
    state.tokensPerSec = 42;
    vi.setSystemTime(4000);
    await dispatchEvent({ type: 'agent_end', reason: 'done' }, ectx, state);
    expect(state.tokensPerSec).toBe(42);
    expect(state.agentRunStartedAt).toBeUndefined();
    expect(state.agentRunLastStreamPartAt).toBeUndefined();
    expect(state.lastAgentRunDurationMs).toBe(3000);
    expect(state.lastAgentRunEndedAt).toBe(4000);
    expect(state.lastAgentRunEndReason).toBe('done');
    vi.setSystemTime(5000);
    await dispatchEvent({ type: 'agent_start' }, ectx, state);
    expect(state.tokensPerSec).toBe(0);
    expect(state.agentRunStartedAt).toBe(5000);
    expect(state.lastAgentRunDurationMs).toBeUndefined();
    expect(state.lastAgentRunEndedAt).toBeUndefined();
  });

  it('does not compute a rate when no output tokens were reported', async () => {
    const state = createMinimalState();
    await decodeStep(state, createEctx(), 0);
    expect(state.tokensPerSec).toBe(0);
  });

  it('does not spike on plan approval resume without a timed model call', async () => {
    const state = createMinimalState({
      streamingMessage: { id: 'plan', role: 'assistant', createdAt: new Date(), content: { format: 2, parts: [] } },
    });
    const ectx = createEctx();
    await dispatchEvent({ type: 'agent_start' }, ectx, state);
    vi.setSystemTime(10_010);
    await dispatchEvent(
      {
        type: 'message_update',
        id: 'plan',
        event: {
          type: 'part',
          index: 0,
          part: {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 't',
              toolName: 'submit_plan',
              args: {},
              state: 'result',
              result: 'approved',
            },
          },
        },
      },
      ectx,
      state,
    );
    vi.setSystemTime(10_020);
    await dispatchEvent(usageEvent(550), ectx, state);
    expect(state.tokensPerSec).toBe(0);
  });

  it('records aborted and error end reasons for run summaries', async () => {
    const ectx = createEctx();
    const abortedState = createMinimalState({ agentRunStartedAt: 1000 });
    vi.setSystemTime(4000);
    await dispatchEvent({ type: 'agent_end', reason: 'aborted' }, ectx, abortedState);
    expect(abortedState.lastAgentRunDurationMs).toBe(3000);
    expect(abortedState.lastAgentRunEndReason).toBe('aborted');
    const errorState = createMinimalState({ agentRunStartedAt: 5000 });
    vi.setSystemTime(9000);
    await dispatchEvent({ type: 'agent_end', reason: 'error' }, ectx, errorState);
    expect(errorState.lastAgentRunDurationMs).toBe(4000);
    expect(errorState.lastAgentRunEndReason).toBe('error');
  });
});
