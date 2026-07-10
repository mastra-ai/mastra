import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GradientAnimator } from '../../src/tui/components/obi-loader.js';
import { updateStatusLine } from '../../src/tui/status-line.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiRef: any;
let latestStyled = '';

export const omStatusIndicatorScenario: McE2eScenario = {
  name: 'om-status-indicator',
  description: 'Verifies the unified opposing-fill OM context indicator in the real TUI.',
  testName: 'renders combined OM usage responsively and confines buffering animation to each segment',
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
    const proofDir = process.env.MC_OM_STATUS_PROOF_DIR;
    if (proofDir) mkdirSync(proofDir, { recursive: true });

    const checkpoint = async (name: string, expected: RegExp) => {
      state.ui.requestRender?.();
      await runtime.waitForScreenText(expected, terminal, 5_000);
      await runtime.sleep(50);
      const view = terminal.serialize().view;
      if (proofDir) {
        writeFileSync(join(proofDir, `${name}.txt`), view);
        writeFileSync(join(proofDir, `${name}.ansi`), latestStyled);
      }
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

    process.stdout.columns = 120;
    setUsage(30_000, 30_000);
    await checkpoint('balanced', /60\/120k↓/);

    setUsage(45_000, 5_000);
    await checkpoint('asymmetric', /50\/120k↓/);

    process.stdout.columns = 60;
    setUsage(30_000, 30_000);
    await checkpoint('narrow', /60\/120k↓/);

    process.stdout.columns = 120;
    let offset = 0;
    const originalGradientAnimator = state.gradientAnimator;
    const gradientAnimator = new GradientAnimator(() => {});
    state.gradientAnimator = gradientAnimator;
    gradientAnimator.isRunning = () => true;
    gradientAnimator.getOffset = () => offset;
    gradientAnimator.getFadeProgress = () => 0;
    displayState.bufferingMessages = true;
    updateStatusLine(state);
    await checkpoint('message-buffer-1', /60\/120k↓/);
    offset = 0.5;
    updateStatusLine(state);
    await checkpoint('message-buffer-2', /60\/120k↓/);

    displayState.bufferingMessages = false;
    displayState.bufferingObservations = true;
    offset = 0;
    updateStatusLine(state);
    await checkpoint('reflection-buffer-1', /60\/120k↓/);
    offset = 0.5;
    updateStatusLine(state);
    await checkpoint('reflection-buffer-2', /60\/120k↓/);

    state.gradientAnimator = originalGradientAnimator;
    process.stdout.columns = originalColumns;
    terminal.keyCtrlC();
  },
};
