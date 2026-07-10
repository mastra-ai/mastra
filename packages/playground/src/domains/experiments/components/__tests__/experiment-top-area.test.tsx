import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { ExperimentTopArea } from '../experiment-top-area';
import { experiments, noAgents, noWorkflows, noScorers } from './fixtures/experiments';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const namedExperiment = experiments[0];
const unnamedExperiment = experiments[2];

function mockTargetRegistries() {
  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
  );
}

describe('ExperimentTopArea', () => {
  afterEach(cleanup);

  it('shows the experiment name and description', async () => {
    mockTargetRegistries();

    const { queryClient } = renderWithProviders(<ExperimentTopArea experiment={namedExperiment} />);

    expect(await screen.findByText('Name')).toBeDefined();
    expect(screen.getByText('entity-extraction / model-a')).toBeDefined();
    expect(screen.getByText('Description')).toBeDefined();
    expect(screen.getByText('Entity extraction evaluation using Model A')).toBeDefined();

    await waitForMutationsIdle(queryClient);
  });

  it('omits the name and description rows when the experiment has neither', async () => {
    mockTargetRegistries();

    const { queryClient } = renderWithProviders(<ExperimentTopArea experiment={unnamedExperiment} />);

    // "Created at" always renders, so waiting on it proves the top area mounted.
    expect(await screen.findByText('Created at')).toBeDefined();
    expect(screen.queryByText('Name')).toBeNull();
    expect(screen.queryByText('Description')).toBeNull();

    await waitForMutationsIdle(queryClient);
  });
});
