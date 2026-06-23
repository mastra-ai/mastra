import { CheckCircle2, Circle, Loader2, ListChecks } from 'lucide-react';

/**
 * Shape of a single task item returned by the task tools.
 * Mirrors `TaskItemSnapshot` from `@mastra/core`.
 */
interface TaskItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/**
 * Shape of the structured result returned by `task_write`, `task_update`,
 * and `task_complete`.
 */
interface TaskToolResult {
  content?: string;
  tasks?: TaskItem[];
  isError?: boolean;
}

/**
 * Extended result shape returned by `task_check`, which adds a summary
 * object and an `incompleteTasks` array.
 */
interface TaskCheckResult extends TaskToolResult {
  summary?: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    incomplete: number;
    hasTasks: boolean;
    allCompleted: boolean;
  };
  incompleteTasks?: TaskItem[];
}

export interface TaskListBadgeProps {
  toolName: string;
  result: unknown;
}

function isTaskToolResult(value: unknown): value is TaskToolResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.tasks);
}

function parseResult(raw: unknown): TaskToolResult | TaskCheckResult | undefined {
  if (isTaskToolResult(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (isTaskToolResult(parsed)) return parsed;
    } catch {
      // not JSON
    }
  }
  return undefined;
}

export const TASK_TOOL_NAMES = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

export function isTaskTool(toolName: string): boolean {
  return TASK_TOOL_NAMES.has(toolName);
}

export function canRenderTaskList(result: unknown): boolean {
  return parseResult(result) !== undefined;
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

/**
 * Renders the structured task list returned by task tools (`task_write`,
 * `task_update`, `task_complete`, `task_check`) as a compact, visual
 * checklist — mirroring the TUI's `TaskProgressComponent`.
 *
 * When the result cannot be parsed (e.g. an error string), falls back to
 * `null` so the caller can render the generic `ToolBadge` instead.
 */
export const TaskListBadge = ({ toolName, result }: TaskListBadgeProps) => {
  const parsed = parseResult(result);
  if (!parsed) return null;

  const { tasks = [], isError } = parsed;

  if (isError && tasks.length === 0) {
    return (
      <div className="mb-3">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs font-medium">
          <ListChecks className="h-3.5 w-3.5" />
          <span>{parsed.content ?? 'Task error'}</span>
        </div>
      </div>
    );
  }

  if (tasks.length === 0) return null;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const allDone = completed === total;

  const summary = (parsed as TaskCheckResult).summary;

  return (
    <div className="mb-3" data-testid="task-list-badge">
      <div className="my-1 rounded-lg border border-border1 bg-surface2 px-3 py-2.5 max-w-[80%]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className={`h-4 w-4 shrink-0 ${allDone ? 'text-green-500' : 'text-accent6'}`} />
          <span className="text-ui-sm leading-ui-sm font-medium text-neutral6">
            {toolName === 'task_check' ? 'Task Check' : 'Tasks'}
          </span>
          <span className="text-ui-xs leading-ui-xs text-neutral4 ml-auto tabular-nums">
            {completed}/{total} completed
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-surface4 mb-2.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-green-500' : 'bg-accent6'}`}
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

        {/* task_check summary footer */}
        {summary && (
          <div className="mt-2 pt-2 border-t border-border1 flex gap-3 text-ui-xs leading-ui-xs text-neutral4">
            {summary.inProgress > 0 && <span>In progress: {summary.inProgress}</span>}
            {summary.pending > 0 && <span>Pending: {summary.pending}</span>}
            <span className={summary.allCompleted ? 'text-green-500 font-medium' : ''}>
              {summary.allCompleted ? 'All completed' : `${summary.incomplete} remaining`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
