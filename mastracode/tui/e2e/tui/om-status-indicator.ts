import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GradientAnimator } from '../../src/tui/components/obi-loader.js';
import { updateStatusLine } from '../../src/tui/status-line.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiRef: any;
let latestStyled = '';

const stripAnsi = (value: string) => value.replace(/\x1b\[[0-9;]*m/g, '');

// The counter sweeps while OM buffers: same text, different styling between animation frames.
function assertCounterSweeps(firstFrame: string, secondFrame: string): void {
  if (stripAnsi(firstFrame) !== stripAnsi(secondFrame)) {
    throw new Error('Expected the status text to stay the same while the counter sweeps');
  }
  if (firstFrame === secondFrame) {
    throw new Error('Expected the context counter to animate while buffering');
  }
}

export const omStatusIndicatorScenario: McE2eScenario = {
  name: 'om-status-indicator',
  description: 'Verifies the OM context counter in the real TUI status line.',
  testName: 'renders combined OM usage as used/capacity with a percentage and sweeps the counter while buffering',
  enableObservationalMemory: true,
  async inProcessApp({ startMastraCodeApp }) {
    const app = await startMastraCodeApp({
      onTuiCreated(tui: any) {
        tuiRef = tui;
      },
    });
    return {
      stop() {
        tuiRef = undefined;
        latestStyled = '';
        return app.stop?.();
      },
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await (
      expect(terminal.getByText(/Mastra Code|Build|Plan|Fast|Type|Press|>/gi, { full: true, strict: false })) as any
    ).toBeVisible();

    const state = tuiRef?.state;
    if (!state?.statusLine) throw new Error('Expected real TUI status line state');
    const setText = state.statusLine.setText.bind(state.statusLine);
    state.statusLine.setText = (value: string) => {
      latestStyled = value;
      setText(value);
    };
    const displayState = state.session.displayState.get();
    const originalColumns = process.stdout.columns;
    const originalGradientAnimator = state.gradientAnimator;
    const originalOmProgress = structuredClone(displayState.omProgress);
    const originalBufferingMessages = displayState.bufferingMessages;
    const originalBufferingObservations = displayState.bufferingObservations;
    const proofDir = process.env.MC_OM_STATUS_PROOF_DIR;
    if (proofDir) mkdirSync(proofDir, { recursive: true });

    const checkpoint = async (name: string, expected: RegExp): Promise<string> => {
      state.ui.requestRender?.();
      await runtime.waitForScreenText(expected, terminal, 5_000);
      await runtime.sleep(50);
      const view = terminal.serialize().view;
      const styled = latestStyled;
      if (proofDir) {
        writeFileSync(join(proofDir, `${name}.txt`), view);
        writeFileSync(join(proofDir, `${name}.ansi`), styled);
      }
      return styled;
    };

    const setUsage = (pendingTokens: number, observationTokens: number) => {
      Object.assign(displayState.omProgress, {
        pendingTokens,
        observationTokens,
        threshold: 80_000,
        reflectionThreshold: 40_000,
        buffered: {
          observations: { projectedMessageRemoval: 2_000 },
          reflection: { status: 'complete', inputObservationTokens: 5_000, observationTokens: 1_000 },
        },
      });
      displayState.bufferingMessages = false;
      displayState.bufferingObservations = false;
      updateStatusLine(state);
    };

    try {
      process.stdout.columns = 120;
      setUsage(30_000, 30_000);
      await checkpoint('balanced', /60\/120k↓ 50%/);

      setUsage(45_000, 5_000);
      await checkpoint('asymmetric', /50\/120k↓ 42%/);

      process.stdout.columns = 60;
      setUsage(30_000, 30_000);
      await checkpoint('narrow', /60\/120k↓ 50%/);

      process.stdout.columns = 120;
      let offset = 0;
      const gradientAnimator = new GradientAnimator(() => {});
      state.gradientAnimator = gradientAnimator;
      gradientAnimator.isRunning = () => true;
      gradientAnimator.getOffset = () => offset;
      gradientAnimator.getFadeProgress = () => 0;
      displayState.bufferingMessages = true;
      updateStatusLine(state);
      const messageFrame1 = await checkpoint('message-buffer-1', /60\/120k↓/);
      offset = 0.5;
      updateStatusLine(state);
      const messageFrame2 = await checkpoint('message-buffer-2', /60\/120k↓/);
      assertCounterSweeps(messageFrame1, messageFrame2);

      displayState.bufferingMessages = false;
      displayState.bufferingObservations = true;
      offset = 0;
      updateStatusLine(state);
      const reflectionFrame1 = await checkpoint('reflection-buffer-1', /60\/120k↓/);
      offset = 0.5;
      updateStatusLine(state);
      const reflectionFrame2 = await checkpoint('reflection-buffer-2', /60\/120k↓/);
      assertCounterSweeps(reflectionFrame1, reflectionFrame2);
    } finally {
      state.statusLine.setText = setText;
      state.gradientAnimator = originalGradientAnimator;
      Object.assign(displayState.omProgress, originalOmProgress);
      displayState.bufferingMessages = originalBufferingMessages;
      displayState.bufferingObservations = originalBufferingObservations;
      process.stdout.columns = originalColumns;
      terminal.keyCtrlC();
    }
  },
};
