// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callFlowResult,
  emptyRecordingReport,
  errorOutcomesCallFlowReport,
  expectationFailedResult,
  failedReplayResult,
  liveResultWithJunkToolReplay,
  mockOnlyCallFlowReport,
  replayResult,
} from '../../__tests__/fixtures/tool-replay';
import type { ReplayTapeSpan } from '../../utils/tool-replay';
import { ExperimentResultPanel } from '../experiment-result-panel';

describe('ExperimentResultPanel tool replay', () => {
  afterEach(cleanup);

  it('renders the replay section with divergence details', () => {
    render(<ExperimentResultPanel result={replayResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('Tool Replay')).toBeDefined();
    expect(screen.getByText('replayed 3/4')).toBeDefined();
    expect(screen.getByText('1 misses')).toBeDefined();
    expect(screen.getByText('1 unconsumed')).toBeDefined();
    expect(screen.getByText('1 arg mismatches')).toBeDefined();
    expect(screen.getByText('stale recording')).toBeDefined();
    expect(screen.getByText('trace-src-1')).toBeDefined();
    // The miss line carries the rejected call's args — under strict matching
    // this is where the differing arguments become visible per item.
    expect(screen.getByText(/called with/)).toBeDefined();
    expect(screen.getByText('{"city":"Paris"}')).toBeDefined();
  });

  it('strips the report from the Output code section', () => {
    render(<ExperimentResultPanel result={replayResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.queryByText(/"toolReplay"/)).toBeNull();
    expect(screen.getByText(/Please send a photo first\./)).toBeDefined();
  });

  it('surfaces the replay error code with a friendly label', () => {
    render(<ExperimentResultPanel result={failedReplayResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText(/Error · TOOL_REPLAY_MISS/)).toBeDefined();
    expect(screen.getByText(/no remaining recorded event/)).toBeDefined();
  });

  it('calls onShowSourceTrace with the source trace id', async () => {
    const onShowSourceTrace = vi.fn();
    render(
      <ExperimentResultPanel
        result={replayResult}
        onClose={vi.fn()}
        isReplayExperiment
        onShowSourceTrace={onShowSourceTrace}
      />,
    );

    screen.getByText('View source trace').click();
    expect(onShowSourceTrace).toHaveBeenCalledWith('trace-src-1');
  });

  it('explains an empty recording instead of a vacuous green chip', () => {
    const emptyRecordingResult = {
      ...replayResult,
      toolReplay: emptyRecordingReport,
      output: { text: 'answered without tools' },
    };
    render(<ExperimentResultPanel result={emptyRecordingResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('no recorded tool calls')).toBeDefined();
    expect(screen.getByText(/The source run never called any tools/)).toBeDefined();
    expect(screen.queryByText('replayed 0/0')).toBeNull();
  });

  it('renders the mocked-tools group and the expectations list with reasons', () => {
    render(<ExperimentResultPanel result={expectationFailedResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('Mocked tools')).toBeDefined();
    expect(screen.getByText('weatherInfo · 2 calls')).toBeDefined();
    expect(screen.getByText('sendEmail · 0 calls')).toBeDefined();

    expect(screen.getByText('Expectations')).toBeDefined();
    expect(screen.getByText('✓ weatherInfo')).toBeDefined();
    expect(screen.getByText('✗ sendEmail')).toBeDefined();
    expect(screen.getByText('expected at least 1 call, got 0')).toBeDefined();

    // Failed mock expectations surface the dedicated error code with a friendly label.
    expect(screen.getByText(/Error · TOOL_MOCK_EXPECTATION_FAILED/)).toBeDefined();
    expect(screen.getByText(/mock expectation was not satisfied/)).toBeDefined();
  });

  it('swaps the empty-recording explainer for the mock-only message when tools were mocked', () => {
    render(<ExperimentResultPanel result={expectationFailedResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('Tools were mocked — no recording involved. Mock answers are listed above.')).toBeDefined();
    expect(screen.queryByText(/The source run never called any tools/)).toBeNull();
    // Empty tape still reads as such — never as a vacuous "replayed 0/0".
    expect(screen.getByText('no recorded tool calls')).toBeDefined();
    expect(screen.queryByText('replayed 0/0')).toBeNull();
  });

  it('renders zero replay chrome outside replay experiments — even with a user toolReplay key', () => {
    render(<ExperimentResultPanel result={liveResultWithJunkToolReplay} onClose={vi.fn()} />);

    expect(screen.queryByText('Tool Replay')).toBeNull();
    // The user-owned key stays visible in the raw output.
    expect(screen.getByText(/oops-user-data/)).toBeDefined();
  });

  it('shows the original and replay outputs side by side when the original result is provided', () => {
    const originalResult = { ...replayResult, id: 'orig-1', output: { text: 'I will refund you right away.' } };
    render(
      <ExperimentResultPanel
        result={replayResult}
        onClose={vi.fn()}
        isReplayExperiment
        originalResult={originalResult}
      />,
    );

    expect(screen.getByText('Output — original run')).toBeDefined();
    expect(screen.getByText('Output — this replay')).toBeDefined();
    // Both answers are visible at once: the source run's text and the replay's text.
    expect(screen.getByText(/I will refund you right away\./)).toBeDefined();
    expect(screen.getByText(/Please send a photo first\./)).toBeDefined();
    expect(screen.getByText(/Same item, same recorded world/)).toBeDefined();
    // The single Output section is replaced by the comparison.
    expect(screen.queryByText('Output')).toBeNull();
  });

  it('keeps the single Output section when no original result is available', () => {
    render(<ExperimentResultPanel result={replayResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('Output')).toBeDefined();
    expect(screen.queryByText('Output — original run')).toBeNull();
    expect(screen.queryByText('Output — this replay')).toBeNull();
  });
});

describe('ExperimentResultPanel re-run with replay', () => {
  afterEach(cleanup);

  it('renders the re-run button on replay runs and fires the callback', () => {
    const onReRunWithReplay = vi.fn();
    render(
      <ExperimentResultPanel
        result={replayResult}
        onClose={vi.fn()}
        isReplayExperiment
        onReRunWithReplay={onReRunWithReplay}
      />,
    );

    const button = screen.getByRole('button', { name: 'Re-run item with replay' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(onReRunWithReplay).toHaveBeenCalledTimes(1);
  });

  it('disables the button while the re-run trigger is pending', () => {
    const onReRunWithReplay = vi.fn();
    render(
      <ExperimentResultPanel
        result={replayResult}
        onClose={vi.fn()}
        isReplayExperiment
        onReRunWithReplay={onReRunWithReplay}
        isReRunPending
      />,
    );

    const button = screen.getByRole('button', { name: 'Re-run item with replay' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onReRunWithReplay).not.toHaveBeenCalled();
  });

  it('renders an inert disabled button with the mock explanation on mock-marked runs', () => {
    render(
      <ExperimentResultPanel
        result={expectationFailedResult}
        onClose={vi.fn()}
        isReplayExperiment
        reRunDisabledReason="Mock values aren't stored on the run yet — re-create the experiment from the trigger dialog."
      />,
    );

    // The inert wrapper carries the disabled semantics (same pattern as the
    // dataset page's gated Run button); the tooltip explains why.
    const button = screen.getByText('Re-run item with replay').closest('button')!;
    const inertWrapper = button.closest('[aria-disabled="true"]')!;
    expect(inertWrapper).not.toBeNull();
    expect(inertWrapper.className).toContain('pointer-events-none');

    fireEvent.focus(button);
    expect(
      screen.getByText("Mock values aren't stored on the run yet — re-create the experiment from the trigger dialog."),
    ).toBeDefined();
  });

  it('renders no re-run button outside replay runs', () => {
    render(<ExperimentResultPanel result={liveResultWithJunkToolReplay} onClose={vi.fn()} />);

    expect(screen.queryByText('Re-run item with replay')).toBeNull();
  });
});

describe('ExperimentResultPanel run flow', () => {
  afterEach(cleanup);

  it('renders the verdict sentence and one ordered row per call', () => {
    render(<ExperimentResultPanel result={callFlowResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('4 tool calls — 2 replayed (1 with different args) · 1 mocked · 1 ran live')).toBeDefined();

    const runFlow = screen.getByTestId('replay-run-flow');
    expect(within(runFlow).getByText('Run flow')).toBeDefined();
    expect(within(runFlow).getByText('#')).toBeDefined();
    expect(within(runFlow).getByText('Tool')).toBeDefined();
    expect(within(runFlow).getByText('Outcome')).toBeDefined();
    expect(within(runFlow).getByText('Notes')).toBeDefined();

    const rows = runFlow.querySelectorAll('.data-list-row');
    expect(rows).toHaveLength(4);
    // Rows keep hook-arrival order and number calls as order + 1.
    expect(rows[0].textContent).toContain('1');
    expect(rows[0].textContent).toContain('get-weather');
    expect(rows[0].textContent).toContain('✓');
    expect(rows[0].textContent).toContain('replayed');
    expect(rows[0].textContent).toContain('tape #1');
    expect(rows[1].textContent).toContain('tape #2 · args differed');
    expect(rows[2].textContent).toContain('send-email');
    expect(rows[2].textContent).toContain('Ⓜ');
    expect(rows[2].textContent).toContain('mocked');
    expect(rows[3].textContent).toContain('get-photos');
    expect(rows[3].textContent).toContain('⚡');
    expect(rows[3].textContent).toContain('ran live (passthrough)');
  });

  it('marks the drifted call with the amber args-differed note', () => {
    render(<ExperimentResultPanel result={callFlowResult} onClose={vi.fn()} isReplayExperiment />);

    // Exact note text — the divergence detail list has its own "args differed from the recording" line.
    const driftNote = screen.getByText('· args differed');
    expect(driftNote.className).toContain('text-amber-400');
    // Only the drifted call carries the note.
    expect(screen.getAllByText('· args differed')).toHaveLength(1);
  });

  it('labels error-path outcomes with their notes', () => {
    render(
      <ExperimentResultPanel
        result={{ ...replayResult, toolReplay: errorOutcomesCallFlowReport }}
        onClose={vi.fn()}
        isReplayExperiment
      />,
    );

    expect(screen.getByText('3 tool calls — 1 replayed · 1 mocked · 1 missed')).toBeDefined();
    expect(screen.getByText('tape #1 · recorded error re-thrown')).toBeDefined();
    expect(screen.getByText('error injected')).toBeDefined();
    expect(screen.getByText('no recorded call left')).toBeDefined();
    expect(screen.getByText('✗')).toBeDefined();
    expect(screen.getByText('miss')).toBeDefined();
  });

  it('shows mocked and live outcomes for mock-only runs', () => {
    const mockOnlyResult = { ...expectationFailedResult, toolReplay: mockOnlyCallFlowReport, error: null };
    render(<ExperimentResultPanel result={mockOnlyResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('2 tool calls — 1 mocked · 1 ran live')).toBeDefined();
    expect(screen.getByText('live')).toBeDefined();
    expect(screen.getByText('ran live (not mocked)')).toBeDefined();
  });

  it('renders the run flow (run perspective) before the recording tape (recording perspective)', () => {
    // The recording behind callFlowReport: get-weather ×2 + create-ticket ×1.
    const sourceTraceSpans: ReplayTapeSpan[] = [
      {
        spanId: 's0',
        spanType: 'tool_call',
        entityName: 'get-weather',
        startedAt: '2026-06-01T10:00:00.000Z',
        endedAt: '2026-06-01T10:00:01.000Z',
      },
      {
        spanId: 's1',
        spanType: 'tool_call',
        entityName: 'get-weather',
        startedAt: '2026-06-01T10:00:01.000Z',
        endedAt: '2026-06-01T10:00:02.000Z',
      },
      {
        spanId: 's2',
        spanType: 'tool_call',
        entityName: 'create-ticket',
        startedAt: '2026-06-01T10:00:02.000Z',
        endedAt: '2026-06-01T10:00:03.000Z',
      },
    ];
    render(
      <ExperimentResultPanel
        result={callFlowResult}
        onClose={vi.fn()}
        isReplayExperiment
        sourceTraceSpans={sourceTraceSpans}
      />,
    );

    const runFlow = screen.getByTestId('replay-run-flow');
    const tapeTitle = screen.getByText('Recording (tape) · FIFO per tool');
    expect(runFlow.compareDocumentPosition(tapeTitle) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('renders no verdict and no run flow when the report predates the calls field', () => {
    render(<ExperimentResultPanel result={replayResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.queryByTestId('replay-run-flow')).toBeNull();
    expect(screen.queryByText('Run flow')).toBeNull();
    expect(screen.queryByText(/\d+ tool call/)).toBeNull();
  });

  it('labels the verdict and the tape with the strict matching policy', () => {
    const sourceTraceSpans: ReplayTapeSpan[] = [
      {
        spanId: 's0',
        spanType: 'tool_call',
        entityName: 'get-weather',
        startedAt: '2026-06-01T10:00:00.000Z',
        endedAt: '2026-06-01T10:00:01.000Z',
      },
    ];
    render(
      <ExperimentResultPanel
        result={callFlowResult}
        onClose={vi.fn()}
        isReplayExperiment
        replayMatching="strict"
        sourceTraceSpans={sourceTraceSpans}
      />,
    );

    expect(
      screen.getByText(
        '4 tool calls — 2 replayed (1 with different args) · 1 mocked · 1 ran live · strict args matching',
      ),
    ).toBeDefined();
    expect(screen.getByText('Recording (tape) · strict args matching')).toBeDefined();
    expect(screen.queryByText('Recording (tape) · FIFO per tool')).toBeNull();
  });

  it('keeps the FIFO tape label and an unsuffixed verdict without the strict marker', () => {
    render(<ExperimentResultPanel result={callFlowResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('4 tool calls — 2 replayed (1 with different args) · 1 mocked · 1 ran live')).toBeDefined();
    expect(screen.queryByText(/strict args matching/)).toBeNull();
  });
});
