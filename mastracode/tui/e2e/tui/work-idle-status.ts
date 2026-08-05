import { updateStatusLine } from '../../src/tui/status-line.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiRef: any;

export const workIdleStatusScenario: McE2eScenario = {
  name: 'work-idle-status',
  description: 'Verifies the TUI active timer, completed status-line timing, and delayed idle line.',
  testName: 'keeps completed timing beside the model and shows delayed idle above the editor',
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
