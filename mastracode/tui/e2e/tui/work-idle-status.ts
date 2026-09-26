import { vi } from 'vitest';

import { updateStatusLine } from '../../src/tui/status-line.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiRef: any;

export const workIdleStatusScenario: McE2eScenario = {
  name: 'work-idle-status',
  description:
    'Verifies the TUI active timer, reasoning-aware decode throughput, completed timing, and delayed idle line.',
  testName: 'shows accurate throughput and completed timing beside the model with delayed idle above the editor',
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
      yield { type: 'finish', payload: { stepResult: { reason: 'stop' } } };
    }
    async function* deliveredStream() {
      for await (const chunk of reasoningStream()) {
        yield chunk;
        // Drain queued TUI events before advancing the fixture's wall clock.
        await runtime.sleep(0);
      }
    }
    try {
      await state.session.processStream({ fullStream: deliveredStream() });
    } finally {
      clock.mockRestore();
    }
    await runtime.waitForScreenText(/\b40 t\/s\b/, terminal);
    const rate = tuiRef?.state?.tokensPerSec;
    if (rate !== 40) {
      throw new Error(`Expected the argument-only step to be measured over its own second, got ${rate} t/s`);
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
