// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  junkMarkerExperiment,
  liveExperiment,
  mockOnlyExperiment,
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

  it('labels a mock-only marker as Mocks', () => {
    render(<ToolReplayChip experiment={mockOnlyExperiment} />);
    expect(screen.getByText('Mocks')).toBeDefined();
    expect(screen.queryByText('Replay')).toBeNull();
  });

  it('labels a combined replay+mocks marker as Replay+Mocks', () => {
    render(
      <ToolReplayChip
        experiment={{
          metadata: {
            toolReplay: { fromExperimentId: 'exp-live-1', onMiss: 'error', mockedTools: ['weatherInfo'] },
          },
        }}
      />,
    );
    expect(screen.getByText('Replay+Mocks')).toBeDefined();
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
    expect(screen.queryByText('Mocks')).toBeNull();
  });
});
