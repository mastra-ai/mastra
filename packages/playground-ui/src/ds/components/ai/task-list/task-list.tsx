import type { TaskItem } from '@mastra/core/signals';
import { CheckCircle2, ChevronRight, Circle, ListChecks, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';

export type TaskListItem = TaskItem;

export const TaskListContainer = ({ className, ...props }: ComponentProps<'section'>) => (
  <section className={cn('rounded-[22px] border border-border2/40 bg-surface3 px-3 py-2.5', className)} {...props} />
);

export const TaskListHeader = ({ className, ...props }: ComponentProps<typeof CollapsibleTrigger>) => (
  <CollapsibleTrigger
    className={cn('flex w-full cursor-pointer items-center gap-2 text-left text-neutral4', className)}
    {...props}
  />
);

export interface TaskListProgressProps extends Omit<ComponentProps<'span'>, 'children'> {
  tasks: TaskListItem[];
}

export const TaskListProgress = ({ tasks, className, ...props }: TaskListProgressProps) => {
  const completed = tasks.filter(task => task.status === 'completed').length;
  return (
    <span
      role="progressbar"
      aria-label="Task completion"
      aria-valuemin={0}
      aria-valuemax={tasks.length}
      aria-valuenow={completed}
      aria-valuetext={`${completed} of ${tasks.length} tasks completed`}
      className={cn('ml-auto shrink-0 text-ui-xs leading-ui-xs text-neutral4 tabular-nums', className)}
      {...props}
    >
      {completed}/{tasks.length}
    </span>
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

const taskLabel = (task: TaskListItem) => (task.status === 'in_progress' ? task.activeForm : task.content);

export interface TaskListStatusIconProps extends ComponentProps<'span'> {
  status: TaskListItem['status'];
}

export const TaskListStatusIcon = ({ status, className, ...props }: TaskListStatusIconProps) => (
  <span aria-label={statusLabels[status]} className={cn('flex pt-0.5', className)} {...props}>
    {icons[status]}
  </span>
);

export interface TaskListRowProps extends ComponentProps<'li'> {
  task: TaskListItem;
}

export const TaskListRow = ({ task, className, ...props }: TaskListRowProps) => (
  <li className={cn('flex items-start gap-2 py-0.5', className)} {...props}>
    <TaskListStatusIcon status={task.status} />
    <span className={cn('text-ui-sm leading-ui-sm', textClasses[task.status])}>{taskLabel(task)}</span>
  </li>
);

const TaskListSummary = ({ task }: { task: TaskListItem }) => (
  <span className="flex min-w-0 flex-1 items-center gap-2">
    <TaskListStatusIcon status={task.status} className="pt-0" />
    <span className={cn('truncate text-ui-sm leading-ui-sm', textClasses[task.status])}>{taskLabel(task)}</span>
  </span>
);

const TaskListTitle = ({ title }: { title: ReactNode }) => (
  <span className="flex min-w-0 flex-1 items-center gap-2">
    <ListChecks className="text-accent6 size-4 shrink-0" />
    <span className="text-ui-sm leading-ui-sm text-neutral6 truncate font-medium">{title}</span>
  </span>
);

const scrollTaskIntoView = (node: HTMLLIElement | null) => {
  if (typeof node?.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
};

export interface TaskListProps extends Omit<ComponentProps<typeof TaskListContainer>, 'children' | 'title'> {
  tasks: TaskListItem[];
  title?: ReactNode;
  hideWhenEmpty?: boolean;
  hideWhenComplete?: boolean;
  scrollActiveIntoView?: boolean;
  defaultOpen?: boolean;
}

export const TaskList = ({
  tasks,
  title = 'Tasks',
  hideWhenEmpty = true,
  hideWhenComplete = true,
  scrollActiveIntoView = true,
  defaultOpen = true,
  ...props
}: TaskListProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const activeTask = tasks.find(task => task.status === 'in_progress');
  const summaryTask = activeTask ?? tasks.find(task => task.status === 'pending');
  const completed = tasks.filter(task => task.status === 'completed').length;
  const total = tasks.length;

  if ((hideWhenEmpty && total === 0) || (hideWhenComplete && total > 0 && completed === total)) return null;

  return (
    <TaskListContainer aria-label="Task list" data-testid="task-list" {...props}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <TaskListHeader>
          <ChevronRight className="size-3.5 shrink-0" />
          {open || !summaryTask ? <TaskListTitle title={title} /> : <TaskListSummary task={summaryTask} />}
          <TaskListProgress tasks={tasks} />
        </TaskListHeader>
        <CollapsibleContent>
          <ScrollArea maxHeight="16rem" viewPortClassName="pr-1" className="mt-1">
            <ul className="space-y-1">
              {tasks.map(task => (
                <TaskListRow
                  key={task.id}
                  ref={scrollActiveIntoView && task.id === activeTask?.id ? scrollTaskIntoView : undefined}
                  task={task}
                />
              ))}
            </ul>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </TaskListContainer>
  );
};
