import type { DatasetExperiment } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompareMetricsMenu } from '../compare-metrics-menu';
import { ExperimentsComparison } from '../experiments-comparison';
import {
  BASELINE_ID,
  CHALLENGER_ID,
  CONTENDER_ID,
  CONTENDER_TRACE_ID,
  contenderTraceFeedback,
  DATASET_ID,
  baselineResults,
  baselineScoreRows,
  challengerResults,
  challengerScoreRows,
  comparisonResponse,
  contenderResults,
  contenderScoreRows,
  contenderTraceSpans,
  datasetItemsById,
  threeWayComparisonResponse,
  usageBreakdownByExperimentId,
} from './fixtures/comparison';
import {
  renamedPostgresWithMetrics,
  storageWithoutMetrics,
} from '@/domains/configuration/hooks/__tests__/fixtures/observability-storage-capabilities';
import { noScorers } from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '@/test/render';

const makeExperiment = (id: string, datasetVersion: number): DatasetExperiment => ({
  id,
  datasetId: DATASET_ID,
  datasetVersion,
  agentVersion: null,
  targetType: 'agent',
  targetId: 'agent-1',
  name: id,
  status: 'completed',
  totalItems: 3,
  succeededCount: 3,
  failedCount: 0,
  startedAt: '2026-08-01T10:00:00.000Z',
  completedAt: '2026-08-01T10:05:00.000Z',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:05:00.000Z',
});

const resultsResponse = (results: unknown[]) => ({
  results,
  pagination: { total: results.length, page: 0, perPage: 100, hasMore: false },
});

const scoresResponse = (scores: unknown[]) => ({
  scores,
  pagination: { total: scores.length, page: 0, perPage: 100, hasMore: false },
});

const experimentsBase = `${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments`;

beforeEach(() => {
  server.use(
    http.post(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/compare`, () => HttpResponse.json(comparisonResponse)),
    http.get(`${experimentsBase}/${BASELINE_ID}`, () => HttpResponse.json(makeExperiment(BASELINE_ID, 1))),
    http.get(`${experimentsBase}/${CONTENDER_ID}`, () => HttpResponse.json(makeExperiment(CONTENDER_ID, 2))),
    http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => HttpResponse.json(resultsResponse(baselineResults))),
    http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => HttpResponse.json(resultsResponse(contenderResults))),
    http.get(`${TEST_BASE_URL}/api/scores/run/${BASELINE_ID}`, () =>
      HttpResponse.json(scoresResponse(baselineScoreRows)),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${CONTENDER_ID}`, () =>
      HttpResponse.json(scoresResponse(contenderScoreRows)),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithoutMetrics)),
    // The trace drawer stays mounted (closed) and loads the scorer registry.
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items/:itemId`, ({ params }) => {
      const item = datasetItemsById[String(params.itemId)];
      return item ? HttpResponse.json(item) : HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }),
  );
});

/** Turns metrics on and answers each experiment's usage breakdown, optionally holding it until `release` resolves. */
const useMetricsUsage = (release?: Promise<void>) => {
  const requestedExperimentIds: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(renamedPostgresWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
      const body = (await request.json()) as { filters?: { experimentId?: string } };
      const experimentId = body.filters?.experimentId ?? '';
      requestedExperimentIds.push(experimentId);
      await release;
      return HttpResponse.json(usageBreakdownByExperimentId[experimentId] ?? { groups: [] });
    }),
  );
  return requestedExperimentIds;
};

const renderComparison = (contenderIds: string[] = [CONTENDER_ID]) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentsComparison datasetId={DATASET_ID} baselineId={BASELINE_ID} contenderIds={contenderIds} />
    </TestLinkProvider>,
    { router: true },
  );

const useThreeWayComparison = () =>
  server.use(
    http.post(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/compare`, () =>
      HttpResponse.json(threeWayComparisonResponse),
    ),
    http.get(`${experimentsBase}/${CHALLENGER_ID}`, () => HttpResponse.json(makeExperiment(CHALLENGER_ID, 1))),
    http.get(`${experimentsBase}/${CHALLENGER_ID}/results`, () =>
      HttpResponse.json(resultsResponse(challengerResults)),
    ),
    http.get(`${TEST_BASE_URL}/api/scores/run/${CHALLENGER_ID}`, () =>
      HttpResponse.json(scoresResponse(challengerScoreRows)),
    ),
  );

type SideName = 'Baseline' | 'Contender 1' | 'Contender 2';

const itemRow = (itemId: string) => screen.getByRole('row', { name: itemId });
const findItemRow = (itemId: string) => screen.findByRole('row', { name: itemId });
const sideOf = (itemId: string, side: SideName) => within(itemRow(itemId)).getByRole('cell', { name: side });
const summaryOf = (side: SideName) =>
  within(screen.getByRole('row', { name: 'Summary' })).getByRole('cell', { name: side });
const findSummaryOf = async (side: SideName) =>
  within(await screen.findByRole('row', { name: 'Summary' })).getByRole('cell', { name: side });

const findOutputOf = (itemId: string, side: SideName) =>
  waitFor(() => within(sideOf(itemId, side)).getByRole('region', { name: 'Output' }));
const isClipped = (section: HTMLElement) =>
  section.querySelector<HTMLElement>('[data-slot="collapsible-box-clip"]')?.style.maxHeight !== '';
/** jsdom does no layout, so every payload is made taller than the collapsed height. */
const makePayloadsOverflow = () => vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);

describe('experiments comparison table', () => {
  describe('when the comparison loads', () => {
    it('renders the Items, Baseline and Contender 1 column headers', async () => {
      renderComparison();

      expect(await screen.findByRole('columnheader', { name: 'Items' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Baseline' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender 1' })).toBeTruthy();
    });

    it('keeps each experiment title in the column header, apart from its summary', async () => {
      renderComparison();

      const baseline = await screen.findByRole('columnheader', { name: 'Baseline' });
      expect(within(baseline).getByRole('button', { name: BASELINE_ID })).toBeTruthy();
      expect(within(baseline).queryByRole('region', { name: 'Summary' })).toBeNull();
      expect(within(await findSummaryOf('Baseline')).getByRole('region', { name: 'Summary' })).toBeTruthy();
    });

    it('renders every item as its own row, without any selection', async () => {
      renderComparison();

      expect(await findItemRow('item-a')).toBeTruthy();
      expect(itemRow('item-b')).toBeTruthy();
      expect(itemRow('item-c')).toBeTruthy();
    });

    it('shows the item input and ground truth by default', async () => {
      renderComparison();
      const row = await findItemRow('item-a');

      const input = await within(row).findByRole('region', { name: 'Input' });
      expect(within(input).getByText(/What is the capital of France/)).toBeTruthy();

      const groundTruth = within(row).getByRole('region', { name: 'Ground truth' });
      expect(within(groundTruth).getByText(/Paris/)).toBeTruthy();
    });

    it('shows both sides of every row at once', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByText(/"Paris"/)).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender 1')).getByText(/"Paris, France"/)).toBeTruthy();
      expect(within(sideOf('item-b', 'Baseline')).getByText(/"Frank Herbert"/)).toBeTruthy();
    });
  });

  describe('when an item row is clicked', () => {
    it('opens the dataset item in a side panel named after it', async () => {
      renderComparison();

      fireEvent.click(await findItemRow('item-a'));

      expect(await screen.findByRole('dialog', { name: 'Dataset item item-a' })).toBeTruthy();
    });

    it('shows the dataset item input and ground truth in the side panel', async () => {
      renderComparison();

      fireEvent.click(await findItemRow('item-a'));

      const panel = await screen.findByRole('dialog', { name: 'Dataset item item-a' });
      const input = await within(panel).findByRole('region', { name: 'Input' });
      expect(within(input).getByText(/What is the capital of France/)).toBeTruthy();
      const groundTruth = within(panel).getByRole('region', { name: 'Ground Truth' });
      expect(within(groundTruth).getByText(/Paris/)).toBeTruthy();
    });

    it('shows the dataset item metadata in the side panel', async () => {
      renderComparison();

      fireEvent.click(await findItemRow('item-a'));

      const panel = await screen.findByRole('dialog', { name: 'Dataset item item-a' });
      expect(await within(panel).findByText(/trivia-set/)).toBeTruthy();
    });
  });

  describe('when the side panel close button is clicked', () => {
    it('closes the dataset item side panel', async () => {
      renderComparison();
      fireEvent.click(await findItemRow('item-a'));
      const panel = await screen.findByRole('dialog', { name: 'Dataset item item-a' });

      // Waits for the loaded item, whose header replaces the loading one.
      await within(panel).findByRole('region', { name: 'Input' });

      fireEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dataset item item-a' })).toBeNull());
    });
  });

  describe('when Enter is pressed on a focused item row', () => {
    it('opens the dataset item in a side panel', async () => {
      renderComparison();

      fireEvent.keyDown(await findItemRow('item-b'), { key: 'Enter' });

      expect(await screen.findByRole('dialog', { name: 'Dataset item item-b' })).toBeTruthy();
    });
  });

  describe('when a control inside an item row is clicked', () => {
    it('does not open the dataset item side panel', async () => {
      renderComparison();
      const trigger = await waitFor(() =>
        within(sideOf('item-a', 'Baseline')).getByRole('button', { name: 'Show accuracy reason' }),
      );

      fireEvent.click(trigger);

      expect(screen.queryByRole('dialog', { name: 'Dataset item item-a' })).toBeNull();
    });
  });

  describe('when the trace button of a cell is clicked', () => {
    beforeEach(() => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/light`, () =>
          HttpResponse.json(contenderTraceSpans),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/:spanId/scores`, () =>
          HttpResponse.json(scoresResponse([])),
        ),
        http.get(`${TEST_BASE_URL}/api/observability/feedback`, () => HttpResponse.json(contenderTraceFeedback)),
      );
    });

    const openContenderTrace = async () => {
      const button = await waitFor(() =>
        within(sideOf('item-a', 'Contender 1')).getByRole('button', { name: 'View trace' }),
      );
      fireEvent.click(button);
    };

    it('opens the trace of that cell in a side panel', async () => {
      renderComparison();

      await openContenderTrace();

      const trace = await screen.findByRole('dialog', { name: `Trace ${CONTENDER_TRACE_ID}` });
      expect(await within(trace).findByText('Contender agent run')).toBeTruthy();
    });

    it('does not open the dataset item side panel', async () => {
      renderComparison();

      await openContenderTrace();

      await screen.findByRole('dialog', { name: `Trace ${CONTENDER_TRACE_ID}` });
      expect(screen.queryByRole('dialog', { name: 'Dataset item item-a' })).toBeNull();
    });
  });

  describe('when Expand is clicked on one output of a row', () => {
    afterEach(() => vi.restoreAllMocks());

    it('expands the output of every experiment in that row', async () => {
      makePayloadsOverflow();
      renderComparison();
      const baselineOutput = await findOutputOf('item-a', 'Baseline');

      fireEvent.click(within(baselineOutput).getByRole('button', { name: 'Expand' }));

      expect(isClipped(baselineOutput)).toBe(false);
      expect(isClipped(await findOutputOf('item-a', 'Contender 1'))).toBe(false);
    });

    it('keeps the outputs of the other rows clipped', async () => {
      makePayloadsOverflow();
      renderComparison();
      const baselineOutput = await findOutputOf('item-a', 'Baseline');

      fireEvent.click(within(baselineOutput).getByRole('button', { name: 'Expand' }));

      expect(isClipped(await findOutputOf('item-b', 'Baseline'))).toBe(true);
    });

    it('does not open the dataset item side panel', async () => {
      makePayloadsOverflow();
      renderComparison();
      const baselineOutput = await findOutputOf('item-a', 'Baseline');

      fireEvent.click(within(baselineOutput).getByRole('button', { name: 'Expand' }));

      expect(screen.queryByRole('dialog', { name: 'Dataset item item-a' })).toBeNull();
    });
  });

  describe('when the fade of a clipped output is clicked', () => {
    afterEach(() => vi.restoreAllMocks());

    it('expands the outputs of that row without opening the side panel', async () => {
      makePayloadsOverflow();
      renderComparison();
      const baselineOutput = await findOutputOf('item-a', 'Baseline');

      const fade = baselineOutput.querySelector<HTMLElement>('[data-slot="collapsible-box-fade"]');
      if (!fade) throw new Error('clipped output has no fade');
      fireEvent.click(fade);

      expect(isClipped(await findOutputOf('item-a', 'Contender 1'))).toBe(false);
      expect(screen.queryByRole('dialog', { name: 'Dataset item item-a' })).toBeNull();
    });
  });

  describe('when the clicked item no longer exists in the dataset', () => {
    it('tells the item could not be loaded in the side panel', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/items/item-a`, () =>
          HttpResponse.json({ error: 'Not found' }, { status: 404 }),
        ),
      );
      renderComparison();

      fireEvent.click(await findItemRow('item-a'));

      const panel = await screen.findByRole('dialog', { name: 'Dataset item item-a' });
      expect(await within(panel).findByText('Dataset item "item-a" not found.')).toBeTruthy();
    });
  });

  describe('when the item is missing from the contender experiment', () => {
    it('shows an explicit empty state on the contender side only', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-c', 'Contender 1')).getByText('Not present in this experiment')).toBeTruthy();
      });
      expect(within(sideOf('item-c', 'Baseline')).getByText(/"42"/)).toBeTruthy();
    });
  });

  describe('when a result carries metadata', () => {
    it('renders the metadata section only on the side that has it', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByText('Metadata')).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Contender 1')).queryByText('Metadata')).toBeNull();
    });
  });

  describe('when scores are known', () => {
    it('shows the delta once, on the contender', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Contender 1')).getByRole('link', { name: 'Open accuracy' })).toBeTruthy();
      });
      // accuracy 0.9 against 0.5.
      expect(within(sideOf('item-a', 'Contender 1')).getByText('+80.0%')).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('%', { exact: false })).toBeNull();
    });
  });

  describe('when a scorer explains its score', () => {
    it('reveals the reason of that side when its info icon is hovered', async () => {
      renderComparison();

      const trigger = await waitFor(() =>
        within(sideOf('item-a', 'Baseline')).getByRole('button', { name: 'Show accuracy reason' }),
      );
      expect(screen.queryByText('Missing the country')).toBeNull();

      fireEvent.mouseEnter(trigger);

      expect(await screen.findByText('Missing the country')).toBeTruthy();
    });
  });

  describe('when a scorer gives no reason', () => {
    it('shows no info icon for that score', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Baseline')).getByRole('link', { name: 'Open relevancy' })).toBeTruthy();
      });
      expect(within(sideOf('item-a', 'Baseline')).queryByRole('button', { name: 'Show relevancy reason' })).toBeNull();
    });
  });

  describe('when a result errored', () => {
    it('renders the error notice instead of the output', async () => {
      renderComparison();

      await waitFor(() => {
        expect(within(sideOf('item-b', 'Contender 1')).getByText('Agent run failed: rate limited')).toBeTruthy();
      });
    });
  });

  describe('when the result queries are still in flight', () => {
    it('keeps the item rows mounted while the sides load', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => new Promise(() => {})),
        http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => new Promise(() => {})),
      );

      renderComparison();

      expect(await findItemRow('item-a')).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).getByRole('status')).toBeTruthy();
    });
  });

  describe('when comparing three experiments', () => {
    it('renders one column header per experiment', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      expect(await screen.findByRole('columnheader', { name: 'Baseline' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender 1' })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: 'Contender 2' })).toBeTruthy();
    });

    it('renders a cell per experiment on every row', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      const row = await findItemRow('item-a');

      // Items cell plus one cell per experiment.
      expect(within(row).getAllByRole('cell')).toHaveLength(4);
    });

    it('shows each contender its own delta against the baseline', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      await waitFor(() => {
        expect(within(sideOf('item-a', 'Contender 1')).getByText('+80.0%')).toBeTruthy();
      });
      // accuracy 0.6 against 0.5, relevancy 0.8 against 0.9.
      expect(within(sideOf('item-a', 'Contender 2')).getByText('+20.0%')).toBeTruthy();
      expect(within(sideOf('item-a', 'Contender 2')).getByText('-11.1%')).toBeTruthy();
      expect(within(sideOf('item-a', 'Baseline')).queryByText('%', { exact: false })).toBeNull();
    });
  });

  describe('when observability storage supports metrics and usage is pending', () => {
    it('keeps the page spinner up instead of the table', async () => {
      const requestedExperimentIds = useMetricsUsage(new Promise(() => {}));
      renderComparison();

      await waitFor(() => expect(requestedExperimentIds).toHaveLength(2));
      expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
      expect(screen.queryByRole('columnheader', { name: 'Items' })).toBeNull();
    });
  });

  describe('when observability storage supports metrics and usage resolves', () => {
    it('renders the comparison table', async () => {
      useMetricsUsage();
      renderComparison();

      expect(await screen.findByRole('columnheader', { name: 'Items' })).toBeTruthy();
      expect(await findItemRow('item-a')).toBeTruthy();
    });

    it('shows each experiment total cost, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      const baseline = await findSummaryOf('Baseline');
      await waitFor(() => expect(within(baseline).getByText('Total cost')).toBeTruthy());
      expect(within(baseline).getByText('$0.002')).toBeTruthy();

      const contender = summaryOf('Contender 1');
      expect(within(contender).getByText('$0.003')).toBeTruthy();
      expect(within(contender).getByText('+100.0%')).toBeTruthy();
    });

    it('reveals the absolute cost difference when the contender delta is focused', async () => {
      useMetricsUsage();
      renderComparison();

      const contender = await findSummaryOf('Contender 1');
      fireEvent.focus(await within(contender).findByText('+100.0%'));

      expect((await screen.findByRole('tooltip')).textContent).toContain('+$0.002');
    });

    it('shows each item cost, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      await findItemRow('item-a');
      const contender = sideOf('item-a', 'Contender 1');
      await waitFor(() => expect(within(contender).getByText('Cost')).toBeTruthy());
      expect(within(contender).getByText('$0.003')).toBeTruthy();
      expect(within(contender).getByText('+100.0%')).toBeTruthy();
    });

    it('shows each experiment total tokens, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      const baseline = await findSummaryOf('Baseline');
      await waitFor(() => expect(within(baseline).getByText('Total tokens')).toBeTruthy());
      expect(within(baseline).getByText('150')).toBeTruthy();

      const contender = summaryOf('Contender 1');
      expect(within(contender).getByText('200')).toBeTruthy();
      expect(within(contender).getByText('+33.3%')).toBeTruthy();
    });

    it('shows each item tokens, with the contender difference against the baseline', async () => {
      useMetricsUsage();
      renderComparison();

      await findItemRow('item-a');
      const contender = sideOf('item-a', 'Contender 1');
      await waitFor(() => expect(within(contender).getByText('Tokens')).toBeTruthy());
      expect(within(contender).getByText('200')).toBeTruthy();
      expect(within(contender).getByText('+33.3%')).toBeTruthy();
    });
  });

  describe('when observability storage does not support metrics', () => {
    it('leaves the cost and the tokens out of the headers and the items', async () => {
      renderComparison();

      await waitFor(() => expect(within(sideOf('item-a', 'Baseline')).getByText(/"Paris"/)).toBeTruthy());
      expect(screen.queryByText('Total cost')).toBeNull();
      expect(screen.queryByText('Cost')).toBeNull();
      expect(screen.queryByText('Total tokens')).toBeNull();
      expect(screen.queryByText('Tokens')).toBeNull();
    });
  });

  describe('when observability storage supports metrics and the results are still loading', () => {
    it('requests the usage of every experiment without waiting for the results', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}/results`, () => new Promise(() => {})),
        http.get(`${experimentsBase}/${CONTENDER_ID}/results`, () => new Promise(() => {})),
      );
      const requestedExperimentIds = useMetricsUsage();
      renderComparison();

      await waitFor(() => expect(requestedExperimentIds.sort()).toEqual([BASELINE_ID, CONTENDER_ID].sort()));
    });
  });

  describe('when the experiments ran on different dataset versions', () => {
    it('shows each experiment the version it ran on, linked to the dataset at that version', async () => {
      renderComparison();

      const baseline = await findSummaryOf('Baseline');
      const contender = summaryOf('Contender 1');
      expect(within(baseline).getByRole('link', { name: 'Open dataset v1' }).getAttribute('href')).toBe(
        `/datasets/${DATASET_ID}?version=1`,
      );
      expect(within(contender).getByRole('link', { name: 'Open dataset v2' }).getAttribute('href')).toBe(
        `/datasets/${DATASET_ID}?version=2`,
      );
    });
  });

  describe('when an experiment has no dataset version', () => {
    it('shows no dataset version on its header', async () => {
      server.use(
        http.get(`${experimentsBase}/${BASELINE_ID}`, () =>
          HttpResponse.json({ ...makeExperiment(BASELINE_ID, 1), datasetVersion: null }),
        ),
      );
      renderComparison();

      const baseline = await findSummaryOf('Baseline');
      expect(within(baseline).queryByRole('link', { name: /^Open dataset v/ })).toBeNull();
    });
  });

  describe('when a contender has a different dataset version than the baseline', () => {
    it('flags the version on that contender header only', async () => {
      useThreeWayComparison();
      renderComparison([CONTENDER_ID, CHALLENGER_ID]);

      const contender = await findSummaryOf('Contender 1');
      await waitFor(() => {
        expect(within(contender).getByText(/differs from baseline/)).toBeTruthy();
      });
      expect(within(summaryOf('Baseline')).queryByText(/differs from baseline/)).toBeNull();
      expect(within(summaryOf('Contender 2')).queryByText(/differs from baseline/)).toBeNull();
    });
  });

  describe('when a metric is unchecked in the metrics picker', () => {
    afterEach(() => localStorage.clear());

    const renderWithPicker = () =>
      renderWithProviders(
        <TestLinkProvider>
          <CompareMetricsMenu datasetId={DATASET_ID} baselineId={BASELINE_ID} contenderIds={[CONTENDER_ID]} />
          <ExperimentsComparison datasetId={DATASET_ID} baselineId={BASELINE_ID} contenderIds={[CONTENDER_ID]} />
        </TestLinkProvider>,
        { router: true },
      );

    const uncheck = async (name: string) => {
      fireEvent.click(await screen.findByRole('button', { name: 'Metrics' }));
      fireEvent.click(await screen.findByRole('menuitemcheckbox', { name }));
    };

    const termsOf = (region: HTMLElement) =>
      within(region)
        .getAllByRole('term')
        .map(term => term.textContent);

    it('hides the metric from the summaries and the item cells', async () => {
      renderWithPicker();
      await findItemRow('item-a');

      await uncheck('Duration');

      await waitFor(() => expect(termsOf(summaryOf('Baseline'))).not.toContain('Avg duration'));
      expect(termsOf(sideOf('item-a', 'Contender 1'))).not.toContain('Duration');
      expect(termsOf(sideOf('item-a', 'Contender 1'))).toContain('Avg score');
    });

    it('hides an unchecked scorer from the summaries and the item cells', async () => {
      renderWithPicker();
      await findItemRow('item-a');

      await uncheck('accuracy');

      await waitFor(() => expect(termsOf(summaryOf('Baseline'))).not.toContain('accuracy'));
      expect(termsOf(sideOf('item-a', 'Baseline'))).not.toContain('accuracy');
      expect(termsOf(sideOf('item-a', 'Baseline'))).toContain('relevancy');
    });

    it('keeps it hidden after the page is reopened', async () => {
      const { unmount } = renderWithPicker();
      await findItemRow('item-a');
      await uncheck('Duration');
      await waitFor(() => expect(termsOf(summaryOf('Baseline'))).not.toContain('Avg duration'));
      unmount();

      renderWithPicker();
      await findItemRow('item-a');

      expect(termsOf(summaryOf('Baseline'))).not.toContain('Avg duration');
    });

    it('brings it back when every metric is shown again', async () => {
      renderWithPicker();
      await findItemRow('item-a');
      await uncheck('Duration');
      await waitFor(() => expect(termsOf(summaryOf('Baseline'))).not.toContain('Avg duration'));

      // Checkbox items keep the picker open.
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Show all metrics' }));

      await waitFor(() => expect(termsOf(summaryOf('Baseline'))).toContain('Avg duration'));
    });
  });

  describe('when the observability storage cannot serve metrics', () => {
    it('offers no cost or tokens entry in the metrics picker', async () => {
      renderWithProviders(
        <TestLinkProvider>
          <CompareMetricsMenu datasetId={DATASET_ID} baselineId={BASELINE_ID} contenderIds={[CONTENDER_ID]} />
        </TestLinkProvider>,
        { router: true },
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Metrics' }));

      expect(await screen.findByRole('menuitemcheckbox', { name: 'Duration' })).toBeTruthy();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Cost' })).toBeNull();
      expect(screen.queryByRole('menuitemcheckbox', { name: 'Tokens' })).toBeNull();
    });
  });

  describe('when an experiment is renamed from its column title', () => {
    let patchBodies: unknown[];

    beforeEach(() => {
      patchBodies = [];
      let contender = makeExperiment(CONTENDER_ID, 2);
      server.use(
        http.get(`${experimentsBase}/${CONTENDER_ID}`, () => HttpResponse.json(contender)),
        http.patch(`${experimentsBase}/${CONTENDER_ID}`, async ({ request }) => {
          const body = (await request.json()) as Partial<DatasetExperiment>;
          patchBodies.push(body);
          contender = { ...contender, ...body };
          return HttpResponse.json(contender);
        }),
      );
    });

    const renameContender = async () => {
      renderComparison();
      fireEvent.click(await screen.findByRole('button', { name: CONTENDER_ID }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename experiment' }));
      const dialog = await screen.findByRole('dialog', { name: 'Rename Experiment' });
      fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Faster prompt' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    };

    it('saves the new name of that experiment', async () => {
      await renameContender();

      await waitFor(() => expect(patchBodies).toEqual([{ name: 'Faster prompt', description: '' }]));
    });

    it('shows the new name in the column title', async () => {
      await renameContender();

      const contender = await screen.findByRole('columnheader', { name: 'Contender 1' });
      expect(await within(contender).findByRole('button', { name: 'Faster prompt' })).toBeTruthy();
    });
  });
});
