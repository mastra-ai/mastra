import type { TaskItem } from '@mastra/core/signals';
import { CheckCircle2, Circle, ListChecks, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TaskListItem = TaskItem;

export const TaskListContainer = ({ className, ...props }: ComponentProps<'section'>) => (
  <section className={cn('rounded-2xl border border-border2/40 bg-surface3 px-3 py-2.5', className)} {...props} />
);

export const TaskListHeader = ({ className, ...props }: ComponentProps<'header'>) => (
  <header className={cn('mb-2 flex items-center gap-2', className)} {...props} />
);

export interface TaskListCountProps extends ComponentProps<'span'> {
  completed: number;
  total: number;
}

export const TaskListCount = ({ completed, total, className, ...props }: TaskListCountProps) => (
  <span className={cn('ml-auto text-ui-xs text-neutral4 tabular-nums', className)} {...props}>
    {completed}/{total} completed
  </span>
);

export interface TaskListProgressProps extends Omit<ComponentProps<'div'>, 'children'> {
  completed: number;
  total: number;
}

export const TaskListProgress = ({ completed, total, className, ...props }: TaskListProgressProps) => {
  const percentage = total === 0 ? 0 : (completed / total) * 100;
  return (
    <div
      role="progressbar"
      aria-label="Task completion"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      className={cn('mb-2.5 h-1 w-full rounded-full bg-surface4', className)}
      {...props}
    >
      <div className="bg-accent6 h-full rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
    </div>
  );
};

const icons: Record<TaskListItem['status'], ReactNode> = {
  completed: <CheckCircle2 className="text-positive1 size-3.5 shrink-0" />,
  in_progress: <Loader2 className="text-warning1 size-3.5 shrink-0 motion-safe:animate-spin" />,
  pending: <Circle className="text-neutral4 size-3.5 shrink-0" />,
};

const statusLabels: Record<TaskListItem['status'], string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
};

const textClasses: Record<TaskListItem['status'], string> = {
  completed: 'text-neutral4 line-through',
  in_progress: 'font-medium text-warning1',
  pending: 'text-neutral5',
};

export interface TaskListStatusIconProps extends ComponentProps<'span'> {
  status: TaskListItem['status'];
}

export const TaskListStatusIcon = ({ status, className, ...props }: TaskListStatusIconProps) => (
  <span aria-label={statusLabels[status]} className={cn('pt-0.5', className)} {...props}>
    {icons[status]}
  </span>
);

export interface TaskListRowProps extends ComponentProps<'li'> {
  task: TaskListItem;
}

export const TaskListRow = ({ task, className, ...props }: TaskListRowProps) => (
  <li className={cn('flex items-start gap-2 py-0.5', className)} {...props}>
    <TaskListStatusIcon status={task.status} />
    <span className={cn('text-ui-sm leading-ui-sm', textClasses[task.status])}>
      {task.status === 'in_progress' ? task.activeForm : task.content}
    </span>
  </li>
);

export interface TaskListProps extends Omit<ComponentProps<typeof TaskListContainer>, 'children' | 'title'> {
  tasks: TaskListItem[];
  title?: ReactNode;
  hideWhenEmpty?: boolean;
  hideWhenComplete?: boolean;
  scrollActiveIntoView?: boolean;
}

export const TaskList = ({
  tasks,
  title = 'Tasks',
  hideWhenEmpty = true,
  hideWhenComplete = true,
  scrollActiveIntoView = true,
  ...props
}: TaskListProps) => {
  const activeTaskRef = useRef<HTMLLIElement | null>(null);
  const activeTaskId = tasks.find(task => task.status === 'in_progress')?.id;
  const completed = tasks.filter(task => task.status === 'completed').length;
  const total = tasks.length;

  useEffect(() => {
    if (!scrollActiveIntoView || !activeTaskRef.current || typeof activeTaskRef.current.scrollIntoView !== 'function')
      return;
    activeTaskRef.current.scrollIntoView({ block: 'nearest' });
  }, [activeTaskId, scrollActiveIntoView]);

  if ((hideWhenEmpty && total === 0) || (hideWhenComplete && total > 0 && completed === total)) return null;

  return (
    <TaskListContainer aria-label="Task list" data-testid="task-list" {...props}>
      <TaskListHeader>
        <ListChecks className="text-accent6 size-4 shrink-0" />
        <h2 className="text-ui-sm leading-ui-sm text-neutral6 font-medium">{title}</h2>
        <TaskListCount completed={completed} total={total} />
      </TaskListHeader>
      <TaskListProgress completed={completed} total={total} />
      <ul className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {tasks.map(task => (
          <TaskListRow key={task.id} ref={task.id === activeTaskId ? activeTaskRef : undefined} task={task} />
        ))}
      </ul>
    </TaskListContainer>
  );
};
