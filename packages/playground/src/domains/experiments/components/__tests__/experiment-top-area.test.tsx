import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentTopArea } from '../experiment-top-area';
import { experiments, noAgents, noWorkflows, noScorers } from './fixtures/experiments';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '@/test/render';

const namedExperiment = experiments[0];
const unnamedExperiment = experiments[2];

describe('ExperimentTopArea', () => {
  afterEach(cleanup);

  // The top area resolves its target through the agents/workflows/scorers
  // registries; empty registries are enough since the name and description
  // under test come from the experiment itself.
  beforeEach(() => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(noAgents)),
      http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)),
      http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(noScorers)),
    );
  });

  describe('when the experiment has a name and description', () => {
    it('shows the name', async () => {
      const { queryClient } = renderWithProviders(<ExperimentTopArea experiment={namedExperiment} />);

      expect(await screen.findByText('entity-extraction / model-a')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });

    it('shows the description', async () => {
      const { queryClient } = renderWithProviders(<ExperimentTopArea experiment={namedExperiment} />);

      expect(await screen.findByText('Entity extraction evaluation using Model A')).toBeDefined();

      await waitForMutationsIdle(queryClient);
    });
  });

  describe('when the experiment has neither a name nor a description', () => {
    it('omits the name row', async () => {
      const { queryClient } = renderWithProviders(<ExperimentTopArea experiment={unnamedExperiment} />);

      // "Created at" always renders, so waiting on it proves the top area mounted.
      expect(await screen.findByText('Created at')).toBeDefined();
      expect(screen.queryByText('Name')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });

    it('omits the description row', async () => {
      const { queryClient } = renderWithProviders(<ExperimentTopArea experiment={unnamedExperiment} />);

      expect(await screen.findByText('Created at')).toBeDefined();
      expect(screen.queryByText('Description')).toBeNull();

      await waitForMutationsIdle(queryClient);
    });
  });
});
