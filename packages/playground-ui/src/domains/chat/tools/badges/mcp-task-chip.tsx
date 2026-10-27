import { useEffect, useState } from 'react';
import { isTerminalMcpTaskStatus } from './use-mcp-task-progress';
import type { McpTaskStatus, McpTaskView } from './use-mcp-task-progress';
import { Badge } from '@/ds/components/Badge';
import type { BadgeIndicator, BadgeVariant } from '@/ds/components/Badge';
import { CopyButton } from '@/ds/components/CopyButton';

const STATUS: Record<McpTaskStatus, { label: string; variant: BadgeVariant; indicator?: BadgeIndicator }> = {
  working: { label: 'working', variant: 'info', indicator: 'pulse' },
  input_required: { label: 'input required', variant: 'warning', indicator: 'dot' },
  completed: { label: 'completed', variant: 'success' },
  failed: { label: 'failed', variant: 'destructive' },
  cancelled: { label: 'cancelled', variant: 'neutral' },
};

/** Now, every second, until `endedAt` is known. */
function useClock(endedAt: number | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (endedAt !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [endedAt]);
  return endedAt ?? now;
}

const formatElapsed = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** `task · working · 0:42` for a tool call that continued as an MCP task, with its task id to copy. */
export function McpTaskChip({ task }: { task: McpTaskView }) {
  const { label, variant, indicator } = STATUS[task.status];
  const terminal = isTerminalMcpTaskStatus(task.status);
  const elapsed = useClock(terminal ? task.endedAt : undefined) - Date.parse(task.createdAt);

  return (
    <span className="inline-flex items-center gap-1" data-testid="mcp-task-chip">
      <Badge
        size="sm"
        variant={variant}
        emphasis="subtle"
        indicator={indicator}
        title={`MCP task ${task.taskId} on ${task.serverName}`}
      >
        task · {label} · <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
      </Badge>
      <CopyButton content={task.taskId} tooltip="Copy MCP task id" copyMessage="Copied MCP task id" />
    </span>
  );
}
