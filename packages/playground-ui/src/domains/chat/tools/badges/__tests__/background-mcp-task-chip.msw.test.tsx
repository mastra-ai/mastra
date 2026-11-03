// @vitest-environment jsdom
import type { BackgroundTaskResponse } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ToolBadge } from '../tool-badge';
import type { McpTaskProgress } from '../use-mcp-task-progress';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const BACKGROUND_TASK_ID = 'bg-05a4940e';

const working: McpTaskProgress = {
  type: 'mcp-task',
  taskId: 'mcp-task-KA3IW6mL',
  status: 'working',
  createdAt: '2026-10-27T12:00:00.000Z',
  serverName: 'reports',
};

const backgroundTask = (status: BackgroundTaskResponse['status'], completedAt?: string): BackgroundTaskResponse => ({
  id: BACKGROUND_TASK_ID,
  status,
  toolName: 'reports_slow_report',
  toolCallId: 'call-1',
  args: { topic: 'q3' },
  agentId: 'tasks-agent',
  runId: 'run-1',
  createdAt: '2026-10-27T12:00:00.000Z',
  completedAt,
  retryCount: 0,
  maxRetries: 0,
  timeoutMs: 60_000,
});

const serveBackgroundTask = (task: BackgroundTaskResponse) => {
  const requests: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/background-tasks/:taskId`, ({ params }) => {
      requests.push(String(params.taskId));
      return HttpResponse.json(task);
    }),
  );
  return requests;
};

/** A deferred call after its turn ended: the card still holds only the first progress write. */
const renderDeferredCall = (result: unknown = [working]) =>
  renderWithProviders(
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={() => {}}
        declineToolcall={() => {}}
        approveToolcallGenerate={() => {}}
        declineToolcallGenerate={() => {}}
        approveNetworkToolcall={() => {}}
        declineNetworkToolcall={() => {}}
        isRunning={false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        <ToolBadge
          toolName="reports_slow_report"
          args={{ topic: 'q3' }}
          toolOutput={[]}
          toolCallId="call-1"
          toolApprovalMetadata={undefined}
          isNetwork={false}
          result={result}
          status="idle"
          backgroundTaskId={BACKGROUND_TASK_ID}
        />
      </ToolCallProvider>
    </TooltipProvider>,
  );

const chipText = () => screen.getByTestId('mcp-task-chip').textContent;

describe('MCP task chip on a deferred tool call', () => {
  describe('when the background task has completed', () => {
    it('shows the task as completed with the elapsed time it took', async () => {
      serveBackgroundTask(backgroundTask('completed', '2026-10-27T12:00:42.000Z'));
      renderDeferredCall();

      await waitFor(() => expect(chipText()).toContain('task · completed · 0:42'));
    });
  });

  describe('when the background task was cancelled', () => {
    it('shows the task as cancelled', async () => {
      serveBackgroundTask(backgroundTask('cancelled', '2026-10-27T12:00:10.000Z'));
      renderDeferredCall();

      await waitFor(() => expect(chipText()).toContain('task · cancelled · 0:10'));
    });
  });

  describe('when the background task timed out', () => {
    it('shows the task as failed', async () => {
      serveBackgroundTask(backgroundTask('timed_out', '2026-10-27T12:01:00.000Z'));
      renderDeferredCall();

      await waitFor(() => expect(chipText()).toContain('task · failed · 1:00'));
    });
  });

  describe('when the background task is still running', () => {
    it('keeps the task working', async () => {
      const requests = serveBackgroundTask(backgroundTask('running'));
      renderDeferredCall();

      await waitFor(() => expect(requests).toEqual([BACKGROUND_TASK_ID]));
      expect(chipText()).toContain('task · working');
    });
  });

  describe('when the progress already shows the task ended', () => {
    it('does not ask for the background task', async () => {
      const requests = serveBackgroundTask(backgroundTask('running'));
      renderDeferredCall([working, { ...working, status: 'failed' }]);

      expect(chipText()).toContain('task · failed');
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(requests).toEqual([]);
    });
  });
});
