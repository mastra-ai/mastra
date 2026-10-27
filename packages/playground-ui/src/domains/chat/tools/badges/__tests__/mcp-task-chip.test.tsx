// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolBadge } from '../tool-badge';
import type { ToolBadgeProps } from '../tool-badge';
import type { McpTaskProgress, McpTaskStatus } from '../use-mcp-task-progress';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { TooltipProvider } from '@/ds/components/Tooltip';

const NOW = Date.parse('2026-10-27T12:00:42.000Z');

const progress = (status: McpTaskStatus): McpTaskProgress => ({
  type: 'mcp-task',
  taskId: 'mcp-task-KA3IW6mL',
  status,
  createdAt: '2026-10-27T12:00:00.000Z',
  serverName: 'reports',
});

const wrap = (node: ReactNode) => (
  <TooltipProvider>
    <ToolCallProvider
      approveToolcall={vi.fn()}
      declineToolcall={vi.fn()}
      approveToolcallGenerate={vi.fn()}
      declineToolcallGenerate={vi.fn()}
      approveNetworkToolcall={vi.fn()}
      declineNetworkToolcall={vi.fn()}
      isRunning={false}
      toolCallApprovals={{}}
      networkToolCallApprovals={{}}
    >
      {node}
    </ToolCallProvider>
  </TooltipProvider>
);

const badge = (props: Pick<ToolBadgeProps, 'result' | 'status'>) =>
  wrap(
    <ToolBadge
      toolName="reports_slow_report"
      args={{ topic: 'q3' }}
      toolOutput={[]}
      toolCallId="call-1"
      toolApprovalMetadata={undefined}
      isNetwork={false}
      {...props}
    />,
  );

const chip = () => screen.queryByTestId('mcp-task-chip');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToolBadge MCP task chip', () => {
  describe('when the tool call continued as an MCP task', () => {
    it('shows the task status and how long it has run', () => {
      render(badge({ result: [progress('working')], status: 'running' }));

      expect(chip()?.textContent).toContain('task · working · 0:42');
    });

    it('keeps the elapsed time ticking while it works', () => {
      render(badge({ result: [progress('working')], status: 'running' }));

      act(() => vi.advanceTimersByTime(5_000));

      expect(chip()?.textContent).toContain('0:47');
    });

    it('copies the MCP task id, not the Mastra background task id', async () => {
      const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
      Object.assign(navigator, { clipboard: { writeText } });
      render(badge({ result: [progress('working')], status: 'running' }));

      fireEvent.click(within(screen.getByTestId('mcp-task-chip')).getByRole('button', { name: 'Copy MCP task id' }));

      expect(writeText).toHaveBeenCalledWith('mcp-task-KA3IW6mL');
    });
  });

  describe('when the task asks for input', () => {
    it('follows the latest status write', () => {
      render(badge({ result: [progress('working'), progress('input_required')], status: 'running' }));

      expect(chip()?.textContent).toContain('task · input required');
    });
  });

  describe('when the final result replaces the progress writes', () => {
    it('keeps the task and shows it completed with the elapsed time stopped', () => {
      const { rerender } = render(badge({ result: [progress('working')], status: 'running' }));

      rerender(badge({ result: { content: [{ type: 'text', text: 'done' }] }, status: 'idle' }));
      act(() => vi.advanceTimersByTime(10_000));

      expect(chip()?.textContent).toContain('task · completed · 0:42');
      expect(
        within(screen.getByTestId('mcp-task-chip')).getByRole('button', { name: 'Copy MCP task id' }),
      ).toBeTruthy();
    });
  });

  describe('when the call ends in an error', () => {
    it('shows the task failed', () => {
      const { rerender } = render(badge({ result: [progress('working')], status: 'running' }));

      rerender(badge({ result: 'MCP task failed: tool exploded', status: 'error' }));

      expect(chip()?.textContent).toContain('task · failed');
    });
  });

  describe('when the last status write was cancelled', () => {
    it('shows the task cancelled rather than failed', () => {
      const { rerender } = render(badge({ result: [progress('working'), progress('cancelled')], status: 'running' }));

      rerender(badge({ result: 'MCP task was cancelled', status: 'error' }));

      expect(chip()?.textContent).toContain('task · cancelled');
    });
  });

  describe('when the tool never ran as a task', () => {
    it('shows no chip', () => {
      render(badge({ result: { content: [{ type: 'text', text: 'done' }] }, status: 'idle' }));

      expect(chip()).toBeNull();
    });

    it('ignores other progress writes', () => {
      render(badge({ result: [{ type: 'progress', percent: 50 }], status: 'running' }));

      expect(chip()).toBeNull();
    });
  });
});
