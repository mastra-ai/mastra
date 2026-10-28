// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { makeMetricsWrapper, useTestMetricsFilters } from '../../../test/metrics-wrapper';
import { server } from '../../../test/msw-server';
import { TEST_BASE_URL } from '../../../test/render';
import { useModelUsageCostMetrics } from '../use-model-usage-cost-metrics';
import { emptyModelBreakdown, sameModelTwoProviders } from './fixtures/model-usage-cost';

function useHook() {
  return useModelUsageCostMetrics(useTestMetricsFilters());
}

describe('useModelUsageCostMetrics', () => {
  describe('when the same model is served by two providers', () => {
    it('groups by model and provider and returns one row per pair', async () => {
      const onBody = vi.fn();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) => {
          const body = await request.json();
          onBody(body);
          if (
            typeof body === 'object' &&
            body !== null &&
            'name' in body &&
            Array.isArray(body.name) &&
            body.name[0] === 'mastra_model_total_input_tokens'
          ) {
            return HttpResponse.json(sameModelTwoProviders);
          }
          return HttpResponse.json(emptyModelBreakdown);
        }),
      );

      const { result } = renderHook(useHook, { wrapper: makeMetricsWrapper() });

      await waitFor(() => expect(result.current.data).toBeDefined());
      expect(onBody).toHaveBeenCalledWith(expect.objectContaining({ groupBy: ['model', 'provider'] }));
      expect(result.current.data?.map(row => [row.model, row.provider, row.cost])).toEqual([
        ['gpt-4o', 'azure', 0.5],
        ['gpt-4o', 'openai', 1],
      ]);
    });
  });
});
