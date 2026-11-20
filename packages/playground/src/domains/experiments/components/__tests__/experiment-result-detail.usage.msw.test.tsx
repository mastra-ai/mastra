// @vitest-environment jsdom
import type { DatasetExperimentResult, GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { experimentTraceFeedback } from '../../__tests__/fixtures/experiment-item-route';
import { ExperimentResultDetail } from '../experiment-result-detail';
import { noScorers } from './fixtures/target-registries';
import {
  metricsCapableCapabilities,
  metricsUnavailableCapabilities,
  traceSpans,
  traceUsageBreakdown,
} from '@/pages/traces/__tests__/fixtures/traces';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '@/test/render';

const makeResult = (overrides: Partial<DatasetExperimentResult> = {}): DatasetExperimentResult => ({
  id: 'res-1',
  experimentId: 'exp-1',
  itemId: 'item-1',
  input: 'hello',
  targetType: 'agent',
  output: 'world',
  groundTruth: null,
  scores: {},
  error: null,
  status: null,
  tags: null,
  comment: null,
  traceId: 'trace-a',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const onTraceRequest = vi.fn();
const onBreakdownRequest = vi.fn();
const onFeedbackRequest = vi.fn();

function serveTrace({
  capabilities,
  rootEntityType,
}: {
  capabilities: GetObservabilityCapabilitiesResponse;
  rootEntityType: EntityType;
}) {
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => {
      onTraceRequest();
      const [root] = traceSpans.spans;
      // Storage does not guarantee root-first ordering: put a child span first.
      return HttpResponse.json({
        ...traceSpans,
        spans: [
          { ...root, spanId: 'span-child', parentSpanId: root.spanId, entityType: EntityType.TOOL },
          { ...root, entityType: rootEntityType },
        ],
      });
    }),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => {
      onBreakdownRequest();
      return HttpResponse.json(traceUsageBreakdown);
    }),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => {
      onFeedbackRequest();
      return HttpResponse.json(experimentTraceFeedback);
    }),
  );
}

function renderDetail(result: DatasetExperimentResult, withFeedback = false) {
  const { wrapper: Wrapper } = makeWrapper();
  const tree = (current: DatasetExperimentResult) => (
    <Wrapper>
      <TestLinkProvider>
        <ExperimentResultDetail result={current} onClose={() => {}} withFeedback={withFeedback} />
      </TestLinkProvider>
    </Wrapper>
  );
  const { rerender } = render(tree(result));
  return { showResult: (next: DatasetExperimentResult) => rerender(tree(next)) };
}

const termLabels = () => screen.getAllByRole('term').map(term => term.textContent);

beforeEach(() => {
  onTraceRequest.mockClear();
  onBreakdownRequest.mockClear();
  onFeedbackRequest.mockClear();
});

afterEach(() => cleanup());

describe('ExperimentResultDetail usage', () => {
  describe('when the result has no trace', () => {
    it('fetches nothing and shows no usage', async () => {
      serveTrace({ capabilities: metricsCapableCapabilities, rootEntityType: EntityType.AGENT });
      renderDetail(makeResult({ traceId: null }));

      await screen.findByText('Item Id');
      expect(onTraceRequest).not.toHaveBeenCalled();
      expect(onBreakdownRequest).not.toHaveBeenCalled();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });

  describe('when the trace is an agent run and metrics are supported', () => {
    it('shows total tokens and cost', async () => {
      serveTrace({ capabilities: metricsCapableCapabilities, rootEntityType: EntityType.AGENT });
      renderDetail(makeResult());

      expect(await screen.findByText('$0.001')).toBeDefined();
      expect(screen.getByText('100')).toBeDefined();
    });
  });

  describe('when the usage of an agent result is still loading', () => {
    it('reserves the cost and tokens rows', async () => {
      serveTrace({ capabilities: metricsCapableCapabilities, rootEntityType: EntityType.AGENT });
      server.use(http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => delay('infinite')));
      renderDetail(makeResult());

      await waitFor(() => expect(onTraceRequest).toHaveBeenCalled());
      expect(termLabels().slice(0, 2)).toEqual(['Cost', 'Tokens']);
    });
  });

  describe('when switching to another agent result whose usage is still loading', () => {
    it('keeps the cost and tokens rows reserved', async () => {
      serveTrace({ capabilities: metricsCapableCapabilities, rootEntityType: EntityType.AGENT });
      const { showResult } = renderDetail(makeResult());
      await screen.findByText('$0.001');

      server.use(http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => delay('infinite')));
      showResult(makeResult({ id: 'res-2', itemId: 'item-2', traceId: 'trace-b' }));
      await waitFor(() => expect(screen.queryByText('$0.001')).toBeNull());
      // Let the trace load and the next usage request start, the window where the rows used to vanish.
      await waitFor(() => expect(onTraceRequest).toHaveBeenCalledTimes(2));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(termLabels().slice(0, 2)).toEqual(['Cost', 'Tokens']);
    });
  });

  describe('when the trace is a workflow run', () => {
    it('skips usage', async () => {
      serveTrace({ capabilities: metricsCapableCapabilities, rootEntityType: EntityType.WORKFLOW });
      renderDetail(makeResult({ targetType: 'workflow' }));

      await waitFor(() => expect(onTraceRequest).toHaveBeenCalled());
      expect(onBreakdownRequest).not.toHaveBeenCalled();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });

  describe('when the observability storage does not support metrics', () => {
    it('skips usage', async () => {
      serveTrace({ capabilities: metricsUnavailableCapabilities, rootEntityType: EntityType.AGENT });
      renderDetail(makeResult());

      await waitFor(() => expect(onTraceRequest).toHaveBeenCalled());
      expect(onBreakdownRequest).not.toHaveBeenCalled();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });
});

describe('ExperimentResultDetail feedback', () => {
  describe('when feedback is shown', () => {
    it('counts the feedback on the result trace in its tab', async () => {
      serveTrace({ capabilities: metricsUnavailableCapabilities, rootEntityType: EntityType.AGENT });
      renderDetail(makeResult(), true);

      expect(await screen.findByRole('tab', { name: 'Feedback (1)' })).toBeDefined();
    });
  });

  describe('when feedback is not shown', () => {
    it('does not fetch it', async () => {
      serveTrace({ capabilities: metricsUnavailableCapabilities, rootEntityType: EntityType.AGENT });
      renderDetail(makeResult());

      await waitFor(() => expect(onTraceRequest).toHaveBeenCalled());
      expect(onFeedbackRequest).not.toHaveBeenCalled();
    });
  });
});
