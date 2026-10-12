import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentResultsSection } from '../experiment-results-section';
import { agentFailedResult, agentMarkdownResult, workflowResult } from './fixtures/experiment-results';
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

function renderSection(results: DatasetExperimentResult[]) {
  return renderWithProviders(
    <TestLinkProvider>
      <ExperimentItemPanelProvider experimentId="exp-1" datasetId="ds-1" results={results} isLoadingResults={false}>
        <ExperimentResultsSection
          experimentId="exp-1"
          results={results}
          isLoading={false}
          selectedIds={new Set()}
          onToggleSelect={() => {}}
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

  describe('when no result has an error', () => {
    it('does not show the Error column header', () => {
      renderSection([agentMarkdownResult, workflowResult]);
      expect(screen.queryByText('Error')).toBeNull();
    });
  });
});
