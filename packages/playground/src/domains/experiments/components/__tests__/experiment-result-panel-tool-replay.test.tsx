// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emptyRecordingReport,
  expectationFailedResult,
  failedReplayResult,
  liveResultWithJunkToolReplay,
  replayResult,
} from '../../__tests__/fixtures/tool-replay';
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
