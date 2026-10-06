// @vitest-environment jsdom
import type {
  ListEmbeddersResponse,
  ListSchedulesResponse,
  ListStoredPromptBlocksResponse,
  ListToolProviderToolkitsResponse,
  ListToolProviderToolsResponse,
  ListToolProvidersResponse,
  ListVectorsResponse,
  MastraClient,
  WorkflowSchedule,
} from '@mastra/client-js';
import { act, cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useEmbedders } from '../embedders';
import { useStoredPromptBlocks } from '../prompt-blocks';
import { useReviewSummary } from '../review';
import { useSchedule, useSchedules, useToggleSchedule } from '../schedules';
import { useProviderTools, useToolProviders, useToolkits } from '../tool-providers';
import { useVectors } from '../vectors';

type ReviewSummaryResponse = Awaited<ReturnType<MastraClient['getExperimentReviewSummary']>>;

const API = `${TEST_BASE_URL}/api`;

const vectors: ListVectorsResponse = { vectors: [] };
const embedders: ListEmbeddersResponse = { embedders: [] };
const schedules: ListSchedulesResponse = { schedules: [] };
const toolProviders: ListToolProvidersResponse = { providers: [] };
const toolkits: ListToolProviderToolkitsResponse = { data: [] };
const tools: ListToolProviderToolsResponse = { data: [] };
const promptBlocks: ListStoredPromptBlocksResponse = {
  promptBlocks: [],
  total: 0,
  page: 1,
  perPage: 20,
  hasMore: false,
};
const reviewSummary: ReviewSummaryResponse = { counts: [] };
const schedule: WorkflowSchedule = {
  id: 'sched-1',
  workflowId: 'wf-1',
  cron: '0 * * * *',
  status: 'active',
  nextFireAt: 0,
  createdAt: 0,
  updatedAt: 0,
};

afterEach(() => cleanup());

describe('useVectors', () => {
  describe('when the server lists vector stores', () => {
    it('returns the vectors response', async () => {
      server.use(http.get(`${API}/vectors`, () => HttpResponse.json(vectors)));
      const { result } = renderHookWithProviders(() => useVectors());
      await waitFor(() => expect(result.current.data).toEqual(vectors));
    });
  });
});

describe('useEmbedders', () => {
  describe('when the server lists embedders', () => {
    it('returns the embedders response', async () => {
      server.use(http.get(`${API}/embedders`, () => HttpResponse.json(embedders)));
      const { result } = renderHookWithProviders(() => useEmbedders());
      await waitFor(() => expect(result.current.data).toEqual(embedders));
    });
  });
});

describe('useSchedules', () => {
  describe('when filtered by workflow', () => {
    it('forwards the filter as a query param', async () => {
      let workflowId: string | null = null;
      server.use(
        http.get(`${API}/schedules`, ({ request }) => {
          workflowId = new URL(request.url).searchParams.get('workflowId');
          return HttpResponse.json(schedules);
        }),
      );
      const { result } = renderHookWithProviders(() => useSchedules({ workflowId: 'wf-1' }));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(workflowId).toBe('wf-1');
    });
  });
});

describe('useSchedule', () => {
  describe('when given a schedule id', () => {
    it('returns that schedule', async () => {
      server.use(http.get(`${API}/schedules/sched-1`, () => HttpResponse.json(schedule)));
      const { result } = renderHookWithProviders(() => useSchedule({ scheduleId: 'sched-1' }));
      await waitFor(() => expect(result.current.data?.id).toBe('sched-1'));
    });
  });
});

describe('useToggleSchedule', () => {
  describe('when pausing a schedule', () => {
    it('posts to the pause endpoint', async () => {
      let paused = false;
      server.use(
        http.post(`${API}/schedules/sched-1/pause`, () => {
          paused = true;
          return HttpResponse.json({ ...schedule, status: 'paused' });
        }),
      );
      const { result } = renderHookWithProviders(() => useToggleSchedule({ scheduleId: 'sched-1' }));
      await act(() => result.current.mutateAsync('pause'));
      expect(paused).toBe(true);
    });
  });
});

describe('useToolProviders', () => {
  describe('when the server lists providers', () => {
    it('returns the providers response', async () => {
      server.use(http.get(`${API}/tool-providers`, () => HttpResponse.json(toolProviders)));
      const { result } = renderHookWithProviders(() => useToolProviders());
      await waitFor(() => expect(result.current.data).toEqual(toolProviders));
    });
  });
});

describe('useToolkits', () => {
  describe('when given a provider', () => {
    it('returns that provider toolkits', async () => {
      server.use(http.get(`${API}/tool-providers/composio/toolkits`, () => HttpResponse.json(toolkits)));
      const { result } = renderHookWithProviders(() => useToolkits({ providerId: 'composio' }));
      await waitFor(() => expect(result.current.data).toEqual(toolkits));
    });
  });
});

describe('useProviderTools', () => {
  describe('when scoped to a toolkit', () => {
    it('forwards the toolkit as a query param', async () => {
      let toolkit: string | null = null;
      server.use(
        http.get(`${API}/tool-providers/composio/tools`, ({ request }) => {
          toolkit = new URL(request.url).searchParams.get('toolkit');
          return HttpResponse.json(tools);
        }),
      );
      const { result } = renderHookWithProviders(() =>
        useProviderTools({ providerId: 'composio', params: { toolkit: 'gmail' } }),
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(toolkit).toBe('gmail');
    });
  });
});

describe('useStoredPromptBlocks', () => {
  describe('when the server lists prompt blocks', () => {
    it('returns the prompt blocks page', async () => {
      server.use(http.get(`${API}/stored/prompt-blocks`, () => HttpResponse.json(promptBlocks)));
      const { result } = renderHookWithProviders(() => useStoredPromptBlocks());
      await waitFor(() => expect(result.current.data).toEqual(promptBlocks));
    });
  });
});

describe('useReviewSummary', () => {
  describe('when the server reports review counts', () => {
    it('returns the summary', async () => {
      server.use(http.get(`${API}/experiments/review-summary`, () => HttpResponse.json(reviewSummary)));
      const { result } = renderHookWithProviders(() => useReviewSummary());
      await waitFor(() => expect(result.current.data).toEqual(reviewSummary));
    });
  });
});
