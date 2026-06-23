import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { CheckCircle2, Circle, ListChecks, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

import { useChatMessages } from './chat/chat-context';
import { isRecord } from './messages/signal-data';
import { TASK_TOOL_NAMES } from './tools/badges/task-list-badge';

interface TaskItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

function isTaskItemArray(value: unknown): value is TaskItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      item =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.content === 'string' &&
        typeof item.status === 'string' &&
        typeof item.activeForm === 'string',
    )
  );
}

function parseTasksFromResult(raw: unknown): TaskItem[] | undefined {
  if (isRecord(raw) && Array.isArray((raw as Record<string, unknown>).tasks)) {
    const tasks = (raw as Record<string, unknown>).tasks;
    if (isTaskItemArray(tasks)) return tasks;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (isRecord(parsed) && isTaskItemArray((parsed as Record<string, unknown>).tasks)) {
        return (parsed as Record<string, unknown>).tasks as TaskItem[];
      }
    } catch {
      // not JSON
    }
  }
  return undefined;
}

function extractLatestTasks(messages: MastraDBMessage[]): TaskItem[] | undefined {
  let latest: TaskItem[] | undefined;

  for (const message of messages) {
    // Check tool invocation parts for task tool results
    if (message.content?.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'tool-invocation' && 'toolInvocation' in part) {
          const inv = (part as { toolInvocation: { toolName: string; result?: unknown } }).toolInvocation;
          if (TASK_TOOL_NAMES.has(inv.toolName) && inv.result !== undefined) {
            const tasks = parseTasksFromResult(inv.result);
            if (tasks) latest = tasks;
          }
        }
      }
    }

    // Check signal messages for task state
    if (message.role === 'signal') {
      const signalMeta = message.content?.metadata?.signal;
      if (isRecord(signalMeta)) {
        const id = signalMeta.id;
        const tagName = signalMeta.tagName;
        const isTaskSignal = id === 'tasks' || tagName === 'current-task-list' || tagName === 'task-list-update';
        if (isTaskSignal) {
          const value =
            isRecord(signalMeta.metadata) && isRecord((signalMeta.metadata as Record<string, unknown>).value)
              ? (signalMeta.metadata as Record<string, unknown>).value
              : undefined;
          const tasks = value ? (value as Record<string, unknown>).tasks : undefined;
          if (isTaskItemArray(tasks)) latest = tasks;
        }
      }
    }

    // Also check data-signal parts that carry task state
    if (message.content?.parts) {
      for (const part of message.content.parts) {
        if (part.type.startsWith('data-') && 'data' in part) {
          const data = (part as { data: unknown }).data;
          if (isRecord(data) && data.type === 'state') {
            const id = data.id;
            const tagName = data.tagName;
            const isTaskSignal = id === 'tasks' || tagName === 'current-task-list' || tagName === 'task-list-update';
            if (isTaskSignal && isRecord(data.metadata)) {
              const value = isRecord((data.metadata as Record<string, unknown>).value)
                ? (data.metadata as Record<string, unknown>).value
                : undefined;
              const tasks = value ? (value as Record<string, unknown>).tasks : undefined;
              if (isTaskItemArray(tasks)) latest = tasks;
            }
          }
        }
      }
    }
  }

  return latest;
}

const statusIcon: Record<TaskItem['status'], React.ReactNode> = {
  completed: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />,
  in_progress: <Loader2 className="h-3.5 w-3.5 shrink-0 text-yellow-500 animate-spin" />,
  pending: <Circle className="h-3.5 w-3.5 shrink-0 text-neutral4" />,
};

const statusTextClass: Record<TaskItem['status'], string> = {
  completed: 'text-neutral4 line-through',
  in_progress: 'text-yellow-500 font-medium',
  pending: 'text-neutral5',
};

export const TaskPanel = () => {
  const messages = useChatMessages();
  const tasks = useMemo(() => extractLatestTasks(messages), [messages]);

  if (!tasks || tasks.length === 0) return null;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const allDone = completed === total;

  // Hide when all tasks are complete (like mastracode TUI)
  if (allDone) return null;

  return (
    <div className="px-2 pb-1" data-testid="task-panel">
      <div className="max-w-3xl w-full mx-auto">
        <div className="rounded-lg border border-border1 bg-surface2 px-3 py-2.5">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="h-4 w-4 shrink-0 text-accent6" />
            <span className="text-ui-sm leading-ui-sm font-medium text-neutral6">Tasks</span>
            <span className="text-ui-xs leading-ui-xs text-neutral4 ml-auto tabular-nums">
              {completed}/{total} completed
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full rounded-full bg-surface4 mb-2.5">
            <div
              className="h-full rounded-full transition-all duration-300 bg-accent6"
              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
            />
          </div>

          {/* Task list */}
          <ul className="space-y-1">
            {tasks.map(task => (
              <li key={task.id} className="flex items-start gap-2 py-0.5">
                {statusIcon[task.status]}
                <span className={`text-ui-sm leading-ui-sm ${statusTextClass[task.status]}`}>
                  {task.status === 'in_progress' ? task.activeForm : task.content}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
