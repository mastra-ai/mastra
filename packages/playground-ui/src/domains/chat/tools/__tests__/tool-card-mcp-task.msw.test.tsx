// @vitest-environment jsdom
import type { BackgroundTaskResponse } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { McpTaskProgress } from '../badges/use-mcp-task-progress';
import { ToolCard } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
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

const backgroundTask = (status: BackgroundTaskResponse['status']): BackgroundTaskResponse => ({
  id: BACKGROUND_TASK_ID,
  status,
  toolName: 'reports_slow_report',
  toolCallId: 'call-1',
  args: { topic: 'q3' },
  agentId: 'tasks-agent',
  runId: 'run-1',
  createdAt: '2026-10-27T12:00:00.000Z',
  completedAt: status === 'completed' ? '2026-10-27T12:00:42.000Z' : undefined,
  retryCount: 0,
  maxRetries: 0,
  timeoutMs: 60_000,
});

/** Serves the background task as `running` until `finish()` is called, recording each poll. */
const serveBackgroundTask = () => {
  let status: BackgroundTaskResponse['status'] = 'running';
  const requests: string[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${TEST_BASE_URL}/api/background-tasks/:taskId`, ({ params }) => {
      requests.push(String(params.taskId));
      return HttpResponse.json(backgroundTask(status));
    }),
  );
  return { requests, finish: () => (status = 'completed') };
};

const card = (output: unknown): ToolCardProps => ({
  toolName: 'reports_slow_report',
  input: { topic: 'q3' },
  output,
  toolCallId: 'call-1',
  state: 'output-available',
  backgroundTaskId: BACKGROUND_TASK_ID,
});

const Shell = ({ props }: { props: ToolCardProps }) => (
  <MemoryRouter>
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
        <ToolCard {...props} />
      </ToolCallProvider>
    </TooltipProvider>
  </MemoryRouter>
);

const chipText = () => screen.getByTestId('mcp-task-chip').textContent;

describe('tool card for a call that continued as an MCP task', () => {
  describe('when its output becomes the "background task" placeholder', () => {
    it('keeps the task chip and keeps polling until the task ends', async () => {
      const background = serveBackgroundTask();
      const { rerender } = renderWithProviders(<Shell props={card([working])} />);
      expect(chipText()).toContain('task · working');

      rerender(<Shell props={card('Background task started with id bg-05a4940e')} />);

      await waitFor(() => expect(background.requests.length).toBeGreaterThan(0));
      expect(chipText()).toContain('task · working');

      background.finish();
      await waitFor(() => expect(chipText()).toContain('task · completed · 0:42'), { timeout: 5_000 });
    });
  });
});
