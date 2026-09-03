import type { DatasetExperiment, DatasetRecord, GetScorerResponse } from '@mastra/client-js';
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentFlowChain } from '../experiment-flow-chain';
import { experiments, noAgents, noProcessors, noWorkflows } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const scorer = (name: string): GetScorerResponse =>
  ({
    scorer: { config: { id: name, name, description: `${name} description` } },
    source: 'code',
    agentIds: [],
    workflowIds: [],
  }) as unknown as GetScorerResponse;

const scorers: Record<string, GetScorerResponse> = {
  'answer-relevancy': scorer('Answer relevancy'),
  toxicity: scorer('Toxicity'),
};

const dataset: DatasetRecord = {
  id: 'dataset-1',
  name: 'Entity extraction dataset',
  version: 3,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const agentExperiment: DatasetExperiment = {
  ...experiments[0],
  datasetVersion: 3,
  scorerIds: ['answer-relevancy', 'toxicity'],
};

const renderChain = (experiment: DatasetExperiment) =>
  renderWithProviders(
    <TestLinkProvider>
      <ExperimentFlowChain experiment={experiment} />
    </TestLinkProvider>,
  );

describe('ExperimentFlowChain', () => {
  afterEach(cleanup);

  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/datasets/dataset-1`, () => HttpResponse.json(dataset)),
      http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
      http.get(`${TEST_BASE_URL}/api/processors`, () => HttpResponse.json(noProcessors)),
      http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(scorers)),
      http.get(`${TEST_BASE_URL}/api/scores/run/:experimentId`, () =>
        HttpResponse.json({
          scores: [{ entityId: 'item-1', scorerId: 'answer-relevancy', score: 0.5 }],
          pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
        }),
      ),
    );
  });

  it('spells out the whole pipeline, from dataset to score', async () => {
    const { queryClient } = renderChain(agentExperiment);

    const datasetLink = await screen.findByRole('link', { name: /Entity extraction dataset/ });
    expect(datasetLink.getAttribute('href')).toBe('/datasets/dataset-1');
    expect(screen.getByText('each item')).toBeDefined();
    expect(screen.getByRole('link', { name: /example-entity-extraction-agent/ })).toBeDefined();
    expect(screen.getByText('output')).toBeDefined();
    expect(screen.getByText('2 scorers')).toBeDefined();
    expect(screen.getByText('comparing ground truth')).toBeDefined();
    expect(screen.getByText('Score')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('opens the dataset and target links in the same tab', async () => {
    const { queryClient } = renderChain(agentExperiment);

    const datasetLink = await screen.findByRole('link', { name: /Entity extraction dataset/ });
    const targetLink = screen.getByRole('link', { name: /example-entity-extraction-agent/ });
    for (const link of [datasetLink, targetLink]) {
      expect(link.getAttribute('target')).toBeNull();
      expect(link.getAttribute('rel')).toBeNull();
    }

    await waitForMutationsIdle(queryClient);
  });

  it('pins the dataset version next to the dataset', async () => {
    const { queryClient } = renderChain(agentExperiment);

    expect(await screen.findByText('(v3)')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('names each node type on its icon, so the chain reads without a legend', async () => {
    const { queryClient } = renderChain(agentExperiment);

    expect(await screen.findByRole('img', { name: 'Dataset' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Agent' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Scorers' })).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('falls back to the scorers that actually scored when none are pinned', async () => {
    // scorerIds is null whenever the scorers resolve from the dataset or the items.
    const { queryClient } = renderChain({ ...agentExperiment, scorerIds: null });

    expect(await screen.findByText('1 scorer')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('keeps a target node without a link for a caller-run experiment', async () => {
    const { queryClient } = renderChain({
      ...agentExperiment,
      targetType: null,
      targetId: null,
    });

    expect(await screen.findByText('External (caller-run)')).toBeDefined();
    expect(screen.queryByRole('link', { name: /External/ })).toBeNull();
    expect(screen.getByRole('img', { name: 'Evaluation target' })).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('switches the node type when the target is a workflow', async () => {
    const { queryClient } = renderChain({
      ...agentExperiment,
      targetType: 'workflow',
      targetId: 'my-workflow',
    });

    const target = await screen.findByRole('link', { name: /my-workflow/ });
    expect(target.getAttribute('href')).toContain('my-workflow');
    expect(screen.getByRole('img', { name: 'Workflow' })).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });
});
