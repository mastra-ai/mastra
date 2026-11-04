// @vitest-environment jsdom
import type { DatasetExperimentResult } from '@mastra/client-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { makeWrapper, TEST_BASE_URL } from '../../../test/render';
import {
  DATASET_ID,
  EXPERIMENT_ID,
  needsReviewResultWithComment,
} from '../../review/__tests__/fixtures/dataset-review-items';
import { useDatasetExperimentResults } from '../use-dataset-experiments';

const BASE_URL = TEST_BASE_URL;

const agentResult: DatasetExperimentResult = {
  ...needsReviewResultWithComment,
  targetType: 'agent',
  output: { text: 'hello', error: { message: 'tool failed' } },
};

const workflowResult: DatasetExperimentResult = {
  ...needsReviewResultWithComment,
  id: 'result-2',
  targetType: 'workflow',
  output: { anything: true },
};

afterEach(() => cleanup());

describe('useDatasetExperimentResults', () => {
  describe('when results come from agent and workflow experiments', () => {
    it('exposes output typed by targetType', async () => {
      server.use(
        http.get(`${BASE_URL}/api/datasets/${DATASET_ID}/experiments/${EXPERIMENT_ID}/results`, () =>
          HttpResponse.json({
            results: [agentResult, workflowResult],
            pagination: { total: 2, page: 0, perPage: 10, hasMore: false },
          }),
        ),
      );

      const { result } = renderHook(
        () => useDatasetExperimentResults({ datasetId: DATASET_ID, experimentId: EXPERIMENT_ID }),
        { wrapper: makeWrapper().wrapper },
      );

      await waitFor(() => expect(result.current.data).toHaveLength(2));
      const [agent, workflow] = result.current.data!;

      if (agent.targetType !== 'agent') throw new Error('expected agent result');
      const text: string | undefined = agent.output?.text;
      expect(text).toBe('hello');
      expect(agent.output?.error?.message).toBe('tool failed');

      expect(workflow.targetType).toBe('workflow');
      expect(workflow.output).toEqual({ anything: true });
    });
  });
});
