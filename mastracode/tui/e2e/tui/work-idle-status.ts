import stripAnsi from 'strip-ansi';
import { vi } from 'vitest';

import { updateStatusLine } from '../../src/tui/status-line.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiRef: any;

export const workIdleStatusScenario: McE2eScenario = {
  name: 'work-idle-status',
  description:
    'Verifies the TUI active timer, reasoning-aware decode throughput, completed timing, and delayed idle line.',
  testName:
    'shows accurate throughput in the Working row and completed timing beside the model with delayed idle above the editor',
  useOpenAIModel: true,
  aimockFixture: 'work-idle-status.json',
  async inProcessApp({ startMastraCodeApp }) {
    const app = await startMastraCodeApp({
      onTuiCreated(tui) {
        tuiRef = tui;
      },
    });
    return {
      stop() {
        tuiRef = undefined;
        return app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    terminal.submit('Run a slow work idle status check.');
    await runtime.waitForScreenText(/\b1s\b/i, terminal, 10_000);
    await runtime.waitForScreenText(/Work idle status response complete\./i, terminal);

    let state = tuiRef?.state;
    for (let i = 0; i < 20 && (!state?.lastAgentRunEndedAt || !state.idleCounter); i++) {
      await runtime.sleep(100);
      state = tuiRef?.state;
    }
    if (!state?.lastAgentRunEndedAt || !state.idleCounter) {
      throw new Error('Expected TUI timing state to be available after agent run');
    }
    // Drive the real engine and TUI with 2,400 thinking tokens over 60s,
    // then 40 answer tokens over 1s. Initial waiting and usage delivery do not count.
    const startedAt = Date.now();
    const clock = vi.spyOn(Date, 'now');
    async function* reasoningStream() {
      clock.mockReturnValue(startedAt);
      yield { type: 'step-start', payload: { messageId: 'throughput-proof', startedAt } };
      clock.mockReturnValue(startedAt + 10_000);
      yield { type: 'reasoning-start', payload: { id: 'reasoning' } };
      yield { type: 'reasoning-delta', payload: { id: 'reasoning', text: 'Checking the result.' } };
      clock.mockReturnValue(startedAt + 70_000);
      yield { type: 'reasoning-end', payload: { id: 'reasoning' } };
      yield { type: 'text-start', payload: { id: 'text' } };
      yield { type: 'text-delta', payload: { id: 'text', text: 'Throughput proof' } };
      clock.mockReturnValue(startedAt + 71_000);
      yield { type: 'text-delta', payload: { id: 'text', text: ' complete.' } };
      yield { type: 'text-end', payload: { id: 'text' } };
      // A goal evaluation closes the assistant message before the step finishes, so the
      // TUI sees message_end ahead of the usage this step still reports.
      yield {
        type: 'goal',
        payload: {
          objective: 'Prove throughput',
          iteration: 1,
          maxRuns: 3,
          passed: false,
          status: 'active',
          results: [],
          duration: 0,
          timedOut: false,
          maxRunsReached: false,
          suppressFeedback: true,
        },
      };
      clock.mockReturnValue(startedAt + 120_000);
      yield {
        type: 'step-finish',
        payload: { output: { usage: { outputTokens: 2440, reasoningTokens: 2400, inputTokens: 100 } } },
      };
      // A step that streams and then reports no usage, followed by a step whose first
      // streamed output is tool arguments. The arguments arrive before their own
      // message_start, so they must rebind the window to their step. Otherwise this
      // step's 40 tokens divide by the earlier step's whole interval.
      clock.mockReturnValue(startedAt + 121_000);
      yield { type: 'step-start', payload: { messageId: 'throughput-unmeasured', startedAt } };
      yield { type: 'text-start', payload: { id: 'unmeasured' } };
      yield { type: 'text-delta', payload: { id: 'unmeasured', text: 'Unmeasured step.' } };
      yield { type: 'text-end', payload: { id: 'unmeasured' } };
      clock.mockReturnValue(startedAt + 150_000);
      yield { type: 'step-start', payload: { messageId: 'throughput-args', startedAt } };
      yield { type: 'tool-call-input-streaming-start', payload: { toolCallId: 'args-1', toolName: 'view' } };
      yield { type: 'tool-call-delta', payload: { toolCallId: 'args-1', argsTextDelta: '{"path"' } };
      clock.mockReturnValue(startedAt + 151_000);
      yield { type: 'tool-call-delta', payload: { toolCallId: 'args-1', argsTextDelta: ':"pkg.json"}' } };
      yield { type: 'tool-call-input-streaming-end', payload: { toolCallId: 'args-1' } };
      yield { type: 'tool-call', payload: { toolCallId: 'args-1', toolName: 'view', args: { path: 'pkg.json' } } };
      yield { type: 'tool-result', payload: { toolCallId: 'args-1', toolName: 'view', result: 'ok' } };
      clock.mockReturnValue(startedAt + 152_000);
      yield { type: 'step-finish', payload: { output: { usage: { outputTokens: 40, inputTokens: 10 } } } };
      // Captured live: the provider opens a thinking block, holds it ~1.2s, then delivers
      // all 155 tokens within 43ms. Timed from the block start this reads 122 t/s, not 3,605.
      clock.mockReturnValue(startedAt + 160_000);
      yield { type: 'step-start', payload: { messageId: 'throughput-held-thinking', startedAt } };
      yield { type: 'reasoning-start', payload: { id: 'held-reasoning' } };
      clock.mockReturnValue(startedAt + 161_230);
      yield { type: 'reasoning-delta', payload: { id: 'held-reasoning', text: 'Held thinking.' } };
      yield { type: 'reasoning-end', payload: { id: 'held-reasoning' } };
      yield { type: 'text-start', payload: { id: 'held-text' } };
      clock.mockReturnValue(startedAt + 161_273);
      yield { type: 'text-delta', payload: { id: 'held-text', text: 'Held answer.' } };
      yield { type: 'text-end', payload: { id: 'held-text' } };
      yield {
        type: 'step-finish',
        payload: { output: { usage: { outputTokens: 155, reasoningTokens: 48, inputTokens: 10 } } },
      };
      // Captured live: the provider held a whole 172-token response and sent it in 5ms, so
      // its generation time cannot be observed. The reading must stay where it was.
      clock.mockReturnValue(startedAt + 172_300);
      yield { type: 'step-start', payload: { messageId: 'throughput-held-response', startedAt } };
      yield { type: 'text-start', payload: { id: 'held-response' } };
      yield { type: 'text-delta', payload: { id: 'held-response', text: 'Held' } };
      clock.mockReturnValue(startedAt + 172_305);
      yield { type: 'text-delta', payload: { id: 'held-response', text: ' response.' } };
      yield { type: 'text-end', payload: { id: 'held-response' } };
      yield { type: 'step-finish', payload: { output: { usage: { outputTokens: 172, inputTokens: 10 } } } };
      yield { type: 'finish', payload: { stepResult: { reason: 'stop' } } };
    }
    const ratesAfterSteps: number[] = [];
    async function* deliveredStream() {
      for await (const chunk of reasoningStream()) {
        yield chunk;
        // Drain queued TUI events before advancing the fixture's wall clock.
        await runtime.sleep(0);
        if (chunk.type === 'step-finish') ratesAfterSteps.push(tuiRef?.state?.tokensPerSec);
      }
    }
    try {
      await state.session.processStream({ fullStream: deliveredStream() });
    } finally {
      clock.mockRestore();
    }
    // Thinking + answer: 40. Argument-only step over its own second: 40. Held thinking
    // timed from its block start: 0.3 * 122 + 0.7 * 40 = 65. Held response: unchanged.
    const expectedRates = [40, 40, 65, 65];
    if (ratesAfterSteps.join() !== expectedRates.join()) {
      throw new Error(`Expected rates ${expectedRates.join(', ')} after each step, got ${ratesAfterSteps.join(', ')}`);
    }
    // Live throughput shows in the Working row above the prompt while a run is active.
    // Checked on the row itself: the run is already over, so other updates can clear it before a frame lands.
    state.agentRunStartedAt = Date.now();
    updateStatusLine(state);
    const workingRow = stripAnsi(state.idleCounter.render(120).join('\n'));
    state.agentRunStartedAt = undefined;
    updateStatusLine(state);
    if (!/\b65 tok\/s\b/.test(workingRow)) {
      throw new Error(`Expected the Working row to show 65 tok/s, got ${JSON.stringify(workingRow)}`);
    }

    state.lastAgentRunDurationMs = 61_000;
    state.lastAgentRunEndReason = 'done';
    updateStatusLine(state);
    state.idleCounter.setTimingState(state);
    state.ui.requestRender?.();
    await runtime.waitForScreenText(/\d+m\d+s\s+✓/i, terminal);

    state.lastAgentRunEndedAt = Date.now() - 60_000;
    state.idleCounter.setTimingState(state);
    state.ui.requestRender?.();

    await runtime.waitForScreenText(/1m idle/i, terminal, 5_000);

    terminal.keyCtrlC();
  },
};
