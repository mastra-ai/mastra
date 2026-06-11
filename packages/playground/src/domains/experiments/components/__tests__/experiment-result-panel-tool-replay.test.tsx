// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emptyRecordingReport,
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
      output: { text: 'answered without tools', toolReplay: emptyRecordingReport },
    };
    render(<ExperimentResultPanel result={emptyRecordingResult} onClose={vi.fn()} isReplayExperiment />);

    expect(screen.getByText('no recorded tool calls')).toBeDefined();
    expect(screen.getByText(/The source run never called any tools/)).toBeDefined();
    expect(screen.queryByText('replayed 0/0')).toBeNull();
  });

  it('renders zero replay chrome outside replay experiments — even with a user toolReplay key', () => {
    render(<ExperimentResultPanel result={liveResultWithJunkToolReplay} onClose={vi.fn()} />);

    expect(screen.queryByText('Tool Replay')).toBeNull();
    // The user-owned key stays visible in the raw output.
    expect(screen.getByText(/oops-user-data/)).toBeDefined();
  });
});
