import type { DatasetExperimentResult } from '@mastra/client-js';
import type { ExperimentStatus } from '@mastra/core/storage';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentResultsSection } from '../experiment-results-section';
import {
  agentFailedResult,
  agentMarkdownResult,
  agentTracedResult,
  workflowResult,
} from './fixtures/experiment-results';
import { experimentUsageBreakdown } from './fixtures/experiment-usage';
import { ExperimentItemPanelProvider } from '@/domains/experiments/context/experiment-item-panel-context';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
      HttpResponse.json({ scores: [], pagination: { total: 0, page: 0, perPage: 100, hasMore: false } }),
    ),
  );
});

afterEach(cleanup);

function renderSection(
  results: DatasetExperimentResult[],
  experimentStatus?: ExperimentStatus,
  { supportsMetrics = false }: { supportsMetrics?: boolean } = {},
) {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentItemPanelProvider experimentId="exp-1" datasetId="ds-1" results={results} isLoadingResults={false}>
        <ExperimentResultsSection
          experimentId="exp-1"
          experimentStatus={experimentStatus}
          supportsMetrics={supportsMetrics}
          results={results}
          isLoading={false}
          selectedIds={new Set()}
          onToggleSelect={() => {}}
          onToggleSelectAll={() => {}}
        />
      </ExperimentItemPanelProvider>
    </TestLinkProvider>,
    { router: true },
  );
}

describe('ExperimentResultsSection', () => {
  describe('when results include agent output text', () => {
    it('shows the Output column header', () => {
      renderSection([agentMarkdownResult]);
      expect(screen.getByText('Output')).toBeTruthy();
    });
  });

  describe('when a result failed', () => {
    it('shows the Error column header', () => {
      renderSection([agentFailedResult]);
      expect(screen.getByText('Error')).toBeTruthy();
    });
  });

  describe('when no result has output text', () => {
    it('does not show the Output column header', () => {
      renderSection([workflowResult]);
      expect(screen.queryByText('Output')).toBeNull();
    });
  });

  describe('when the run finished without results', () => {
    it('shows the plain empty state', () => {
      renderSection([], 'completed');
      expect(screen.getByText('No results yet')).toBeTruthy();
    });
  });

  describe('when no result has an error', () => {
    it('does not show the Error column header', () => {
      renderSection([agentMarkdownResult, workflowResult]);
      expect(screen.queryByText('Error')).toBeNull();
    });
  });

  describe('when a result has a start time and tags', () => {
    it('shows neither a Created nor a Tags column', () => {
      renderSection([{ ...agentTracedResult, tags: ['alpha'] }]);
      expect(screen.queryByText('Created')).toBeNull();
      expect(screen.queryByText('Tags')).toBeNull();
      expect(screen.queryByText('alpha')).toBeNull();
    });
  });

  describe('when a result has start and end times', () => {
    it('shows how long the item took', () => {
      renderSection([agentTracedResult]);
      expect(screen.getByText('Duration')).toBeTruthy();
      expect(screen.getByTestId('result-duration-res-agent-traced').textContent).toBe('2.5s');
    });
  });

  describe('when metrics are not supported', () => {
    it('does not show the Cost and Tokens columns', () => {
      renderSection([agentTracedResult]);
      expect(screen.queryByText('Cost')).toBeNull();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });

  describe('when metrics are supported', () => {
    beforeEach(() => {
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () =>
          HttpResponse.json(experimentUsageBreakdown),
        ),
      );
    });

    it('shows the Cost and Tokens columns', () => {
      renderSection([agentTracedResult], 'completed', { supportsMetrics: true });
      expect(screen.getByText('Cost')).toBeTruthy();
      expect(screen.getByText('Tokens')).toBeTruthy();
    });

    it('shows the cost of each traced item', async () => {
      renderSection([agentTracedResult], 'completed', { supportsMetrics: true });
      await waitFor(() => expect(screen.getByTestId('result-cost-res-agent-traced').textContent).toBe('$0.002'));
    });

    it('shows the input plus output tokens of each traced item', async () => {
      renderSection([agentTracedResult], 'completed', { supportsMetrics: true });
      await waitFor(() => expect(screen.getByTestId('result-tokens-res-agent-traced').textContent).toBe('1,500'));
    });

    it('leaves usage empty for items without a trace', async () => {
      renderSection([agentTracedResult, workflowResult], 'completed', { supportsMetrics: true });
      await waitFor(() => expect(screen.getByTestId('result-cost-res-agent-traced').textContent).toBe('$0.002'));
      expect(screen.getByTestId('result-cost-res-workflow').textContent).toBe('-');
      expect(screen.getByTestId('result-tokens-res-workflow').textContent).toBe('-');
    });
  });
});
