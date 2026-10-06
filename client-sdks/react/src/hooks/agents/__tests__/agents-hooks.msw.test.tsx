// @vitest-environment jsdom
import type { BackgroundTaskResponse, GetAgentPlanResponse } from '@mastra/client-js';
import type { AgentChunkType } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import { cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../test/render';
import { useAgentPlan } from '../use-agent-plan';
import { useBackgroundTaskStream, useGetBackgroundTaskById } from '../use-background-tasks';
import { useBrowserSessionProbe } from '../use-browser-session-probe';

const API = `${TEST_BASE_URL}/api`;

const planResponse: GetAgentPlanResponse = { path: 'plan.md', content: '# Plan\n- step one' };

const completedEvent: Extract<AgentChunkType, { type: 'background-task-completed' }> = {
  type: 'background-task-completed',
  runId: 'run-1',
  from: ChunkFrom.AGENT,
  payload: {
    taskId: 'task-1',
    toolName: 'research',
    toolCallId: 'call-1',
    agentId: 'agent-1',
    runId: 'run-1',
    result: { summary: 'done' },
    completedAt: new Date('2026-10-02T00:00:00Z'),
  },
};

afterEach(() => cleanup());

describe('useAgentPlan', () => {
  describe('when the agent has a plan file', () => {
    it('returns the plan content', async () => {
      server.use(
        http.get(`${API}/agents/agent-1/plans/file`, ({ request }) =>
          new URL(request.url).searchParams.get('path') === 'plan.md'
            ? HttpResponse.json(planResponse)
            : HttpResponse.json({ error: 'not found' }, { status: 404 }),
        ),
      );

      const { result } = renderHookWithProviders(() => useAgentPlan({ agentId: 'agent-1', path: 'plan.md' }));

      await waitFor(() => expect(result.current.data).toEqual(planResponse));
    });
  });
});

describe('useBrowserSessionProbe', () => {
  describe('when the server reports an active session', () => {
    it('returns the probe result', async () => {
      server.use(
        http.get(`${API}/agents/agent-1/browser/session`, () =>
          HttpResponse.json({ hasSession: true, screencastAvailable: false }),
        ),
      );

      const { result } = renderHookWithProviders(() =>
        useBrowserSessionProbe({ agentId: 'agent-1', threadId: 'thread-1' }),
      );

      await waitFor(() => expect(result.current.data).toEqual({ hasSession: true, screencastAvailable: false }));
    });
  });

  describe('when the server predates the probe endpoint', () => {
    it('falls back to assuming a live session', async () => {
      server.use(
        http.get(`${API}/agents/agent-1/browser/session`, () =>
          HttpResponse.json({ error: 'not found' }, { status: 404 }),
        ),
      );

      const { result } = renderHookWithProviders(() =>
        useBrowserSessionProbe({ agentId: 'agent-1', threadId: 'thread-1' }),
      );

      await waitFor(() => expect(result.current.data).toEqual({ hasSession: true, screencastAvailable: true }));
    });
  });
});

describe('useGetBackgroundTaskById', () => {
  describe('when the task exists', () => {
    it('returns the task', async () => {
      const task: BackgroundTaskResponse = {
        id: 'task-1',
        status: 'completed',
        toolName: 'research',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        runId: 'run-1',
        createdAt: '2026-10-02T00:00:00.000Z',
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 60_000,
      };
      server.use(http.get(`${API}/background-tasks/task-1`, () => HttpResponse.json(task)));

      const { result } = renderHookWithProviders(() => useGetBackgroundTaskById({ backgroundTaskId: 'task-1' }));

      await waitFor(() => expect(result.current.data).toEqual(task));
    });
  });
});

describe('useBackgroundTaskStream', () => {
  describe('when the stream emits a completed task', () => {
    it('lists the task as completed', async () => {
      server.use(
        http.get(
          `${API}/background-tasks/stream`,
          () =>
            new HttpResponse(`data: ${JSON.stringify(completedEvent)}\n\n`, {
              headers: { 'Content-Type': 'text/event-stream' },
            }),
        ),
      );

      const { result } = renderHookWithProviders(() => useBackgroundTaskStream({ agentId: 'agent-1' }));

      await waitFor(() => expect(result.current.completedTasks.map(task => task.taskId)).toEqual(['task-1']));
    });
  });
});
