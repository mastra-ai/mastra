// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExperimentResultDetailState } from '../../hooks/use-experiment-result-detail-state';
import { ExperimentResultDetail } from '../experiment-result-detail';
import type { ExperimentResultDetailProps } from '../experiment-result-detail';
import { agentTracedResult } from './fixtures/experiment-results';
import { tracedResultScores } from './fixtures/experiment-scores';
import { TestLinkProvider } from '@/test/link-provider';

afterEach(cleanup);

const TracePanelStub = ({ state }: { state: ExperimentResultDetailState }) =>
  state.featuredTraceId ? <aside aria-label="Trace">{state.featuredTraceId}</aside> : null;

const renderDetail = (props: Partial<ExperimentResultDetailProps> = {}) =>
  render(
    <TestLinkProvider>
      <ExperimentResultDetail
        variant="inline"
        result={agentTracedResult}
        scores={tracedResultScores}
        onClose={() => {}}
        {...props}
      />
    </TestLinkProvider>,
  );

describe('ExperimentResultDetail', () => {
  describe('when the host renders traces', () => {
    const tracePanel = (state: ExperimentResultDetailState) => <TracePanelStub state={state} />;

    it('opens the result trace in the trace panel', () => {
      renderDetail({ tracePanel });

      fireEvent.click(screen.getByRole('button', { name: 'See trace' }));

      expect(screen.getByRole('complementary', { name: 'Trace' }).textContent).toBe('trace-res-agent-traced');
    });
  });

  describe('when the host renders no traces', () => {
    it('offers no trace link', () => {
      renderDetail();

      expect(screen.queryByRole('button', { name: 'See trace' })).toBeNull();
    });
  });

  describe('when a score is clicked', () => {
    it('opens that score next to the result', async () => {
      renderDetail();

      fireEvent.click(screen.getByRole('button', { name: 'accuracy' }));

      expect(await screen.findByText('Score accuracy')).toBeDefined();
    });
  });
});
