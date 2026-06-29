import type { TaskItem } from '@mastra/core/signals';
import { CheckCircle2, Circle, ListChecks, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { useChatTasks } from './chat/chat-context';

const statusIcon: Record<TaskItem['status'], ReactNode> = {
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
  const tasks = useChatTasks();
  const activeTaskRef = useRef<HTMLLIElement | null>(null);
  const activeTaskId = tasks.find(task => task.status === 'in_progress')?.id;

  useEffect(() => {
    if (!activeTaskRef.current || typeof activeTaskRef.current.scrollIntoView !== 'function') return;

    activeTaskRef.current.scrollIntoView({ block: 'nearest' });
  }, [activeTaskId]);

  if (tasks.length === 0) return null;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const allDone = completed === total;

  // Hide when all tasks are complete (like mastracode TUI)
  if (allDone) return null;

  return (
    <div className="px-2 pb-1" data-testid="task-panel">
      <div className="max-w-3xl w-full mx-auto">
        <div className="rounded-2xl border border-border2/40 bg-surface3 px-3 py-2.5">
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
          <ul className="max-h-32 space-y-1 overflow-y-auto pr-1">
            {tasks.map(task => (
              <li
                key={task.id}
                ref={task.id === activeTaskId ? activeTaskRef : undefined}
                className="flex items-start gap-2 py-0.5"
              >
                <span className="pt-0.5">{statusIcon[task.status]}</span>
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
