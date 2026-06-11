// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  junkMarkerExperiment,
  liveExperiment,
  noOnMissMarkerExperiment,
  replayExperiment,
} from '../../__tests__/fixtures/tool-replay';
import { ToolReplayChip } from '../tool-replay-chip';

describe('ToolReplayChip', () => {
  afterEach(cleanup);

  it('renders for an experiment stamped with the replay marker', () => {
    render(<ToolReplayChip experiment={replayExperiment} />);
    expect(screen.getByText('Replay')).toBeDefined();
  });

  it('renders nothing for live experiments and user-owned toolReplay metadata', () => {
    render(
      <>
        <ToolReplayChip experiment={liveExperiment} />
        <ToolReplayChip experiment={junkMarkerExperiment} />
        <ToolReplayChip experiment={noOnMissMarkerExperiment} />
      </>,
    );
    expect(screen.queryByText('Replay')).toBeNull();
  });
});
