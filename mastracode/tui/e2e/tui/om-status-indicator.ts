import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GradientAnimator } from '../../src/tui/components/obi-loader.js';
import { updateStatusLine } from '../../src/tui/status-line.js';
import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

let tuiRef: any;
let latestStyled = '';

function extractBarCellStyles(styled: string): string[] {
  const cells: string[] = [];
  let activeStyle = '';
  for (const match of styled.matchAll(/\x1b\[[0-9;]*m|━/g)) {
    const token = match[0];
    if (token === '━') {
      cells.push(activeStyle);
    } else if (token === '\x1b[0m' || token === '\x1b[39m') {
      activeStyle = '';
    } else if (/^\x1b\[(?:3\d|9\d|38;)/.test(token)) {
      activeStyle = token;
    }
  }
  return cells.slice(0, 10);
}

function assertSegmentAnimation(
  firstFrame: string,
  secondFrame: string,
  activeRange: [start: number, end: number],
): void {
  const first = extractBarCellStyles(firstFrame);
  const second = extractBarCellStyles(secondFrame);
  if (first.length !== 10 || second.length !== 10) {
    throw new Error(`Expected 10 styled context cells, got ${first.length} and ${second.length}`);
  }

  const [start, end] = activeRange;
  if (JSON.stringify(first.slice(start, end)) === JSON.stringify(second.slice(start, end))) {
    throw new Error(`Expected context cells ${start}-${end - 1} to animate`);
  }
  if (JSON.stringify(first.slice(0, start)) !== JSON.stringify(second.slice(0, start))) {
    throw new Error(`Expected context cells before ${start} to remain static`);
  }
  if (JSON.stringify(first.slice(end)) !== JSON.stringify(second.slice(end))) {
    throw new Error(`Expected context cells after ${end - 1} to remain static`);
  }
}

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
      await checkpoint('balanced', /60\/120k↓/);

      setUsage(45_000, 5_000);
      await checkpoint('asymmetric', /50\/120k↓/);

      process.stdout.columns = 60;
      setUsage(30_000, 30_000);
      await checkpoint('narrow', /60\/120k↓/);

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
      // Balanced usage renders 2 memory cells, 3 message cells, then 5 unused cells.
      assertSegmentAnimation(messageFrame1, messageFrame2, [2, 5]);

      displayState.bufferingMessages = false;
      displayState.bufferingObservations = true;
      offset = 0;
      updateStatusLine(state);
      const reflectionFrame1 = await checkpoint('reflection-buffer-1', /60\/120k↓/);
      offset = 0.5;
      updateStatusLine(state);
      const reflectionFrame2 = await checkpoint('reflection-buffer-2', /60\/120k↓/);
      assertSegmentAnimation(reflectionFrame1, reflectionFrame2, [0, 2]);
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
