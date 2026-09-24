import type { TaskItem } from '@mastra/core/signals';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { ComponentProps } from 'react';
import { TaskGraphLines } from './task-graph';
import { TASK_ROW_HEIGHT, taskGraphLaneShift, taskGraphMotion, taskGraphNodeClass } from './task-graph-node';
import { taskWindowHeight, useFocusedRowScroll } from './use-focused-row-scroll';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { focusRing, transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TaskListItem = TaskItem;

export const TaskListContainer = ({ className, ...props }: ComponentProps<'section'>) => (
  <section className={cn(raisedSurfaceStyle, 'overflow-hidden rounded-2xl', className)} {...props} />
);

const barColors: Record<TaskListItem['status'], string> = {
  completed: 'bg-positive1',
  in_progress: 'bg-warning1',
  pending: 'bg-fill-hover',
};

export interface TaskListProgressProps extends Omit<ComponentProps<'span'>, 'children'> {
  tasks: TaskListItem[];
}

export const TaskListProgress = ({ tasks, className, ...props }: TaskListProgressProps) => {
  const completed = tasks.filter(task => task.status === 'completed').length;
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              role="progressbar"
              aria-label="Task completion"
              aria-valuemin={0}
              aria-valuemax={tasks.length}
              aria-valuenow={completed}
              className={cn('ml-auto flex h-4 w-fit max-w-40 shrink-0 items-center gap-1 overflow-hidden', className)}
              {...props}
            >
              {tasks.map(task => (
                <span
                  key={task.id}
                  className={cn(
                    'h-full w-0.5 min-w-px shrink rounded-full transition-colors',
                    taskGraphMotion,
                    barColors[task.status],
                  )}
                />
              ))}
            </span>
          }
        />
        <TooltipContent>
          {completed}/{tasks.length} completed
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const statusLabels: Record<TaskListItem['status'], string> = {
  completed: 'Completed',
  in_progress: 'In progress',
  pending: 'Pending',
};

const ringClasses: Record<TaskListItem['status'], string> = {
  completed: 'size-[7px] border-accent1 bg-card',
  in_progress: 'size-2 border-accent6 bg-accent6/25',
  pending: 'size-1.5 border-muted-foreground/45 bg-card',
};

export interface TaskListStatusIconProps extends ComponentProps<'span'> {
  status: TaskListItem['status'];
}

export const TaskListStatusIcon = ({ status, className, ...props }: TaskListStatusIconProps) => (
  <span
    role="img"
    aria-label={statusLabels[status]}
    className={cn('grid size-3 shrink-0 place-items-center rounded-full', className)}
    {...props}
  >
    <span
      className={cn(
        'rounded-full border-[1.5px] transition-[width,height,border-color,background-color]',
        taskGraphMotion,
        ringClasses[status],
      )}
    />
  </span>
);

const TaskListLabel = ({ task }: { task: TaskListItem }) => {
  const active = task.status === 'in_progress';
  return (
    <span className="grid min-w-0 text-caption">
      <span
        aria-hidden={active}
        className={cn(
          'col-start-1 row-start-1 truncate transition-[opacity,color,translate,filter]',
          taskGraphMotion,
          task.status === 'pending' ? 'text-muted-foreground/70' : 'text-muted-foreground',
          active ? '-translate-y-1 opacity-0 blur-[2px]' : 'translate-y-0 opacity-100 blur-none',
        )}
      >
        <span
          className={cn(
            'bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat transition-[background-size]',
            taskGraphMotion,
            task.status === 'completed'
              ? 'bg-size-[100%_1px] bg-position-[left_55%]'
              : 'bg-size-[0%_1px] bg-position-[right_55%]',
          )}
        >
          {task.content}
        </span>
      </span>
      <span
        aria-hidden={!active}
        className={cn(
          'col-start-1 row-start-1 truncate bg-linear-to-r from-accent6 to-foreground to-30% bg-size-[200%_100%] bg-clip-text font-medium text-transparent transition-[opacity,translate,filter,background-position] dark:from-[color-mix(in_oklab,var(--accent6)_60%,var(--foreground))]',
          taskGraphMotion,
          active
            ? 'translate-y-0 bg-position-[0%_0] opacity-100 blur-none'
            : 'translate-y-1 bg-position-[100%_0] opacity-0 blur-[2px]',
        )}
      >
        {task.activeForm}
      </span>
    </span>
  );
};

export interface TaskListRowProps extends ComponentProps<'li'> {
  task: TaskListItem;
}

export const TaskListRow = ({ task, className, style, ...props }: TaskListRowProps) => (
  <li className={cn('relative flex items-center', className)} style={{ height: TASK_ROW_HEIGHT, ...style }} {...props}>
    <TaskListStatusIcon
      status={task.status}
      className={cn(
        taskGraphNodeClass,
        taskGraphMotion,
        taskGraphLaneShift[task.status],
        'group-data-collapsed/task-list:translate-x-0',
      )}
    />
    <span
      className={cn(
        'flex min-w-0 transition-[padding-left]',
        taskGraphMotion,
        task.status === 'in_progress' ? 'pl-10 group-data-collapsed/task-list:pl-6' : 'pl-6',
      )}
    >
      <TaskListLabel task={task} />
    </span>
  </li>
);

const LIST_INSET_Y = 10;

/* A full layer minus one fade per edge; the fades are sized by mask-size, so their depth animates. */
const edgeFades =
  'mask-no-repeat [--fade-bottom:0.875rem] [--fade-top:0.875rem] [mask-composite:subtract,add] [mask-image:linear-gradient(black,black),linear-gradient(to_bottom,black_40%,transparent),linear-gradient(to_top,black_40%,transparent)] [mask-position:0_0,0_0,0_100%] [mask-size:100%_100%,100%_var(--fade-top),100%_var(--fade-bottom)]';
const edgeFadesWhenScrolled = 'data-[overflow-y-end]:[--fade-bottom:2rem] data-[overflow-y-start]:[--fade-top:2rem]';

const focusedTaskIndex = (tasks: TaskListItem[]) => {
  const activeIndex = tasks.findIndex(task => task.status === 'in_progress');
  if (activeIndex >= 0) return activeIndex;
  const pendingIndex = tasks.findIndex(task => task.status === 'pending');
  if (pendingIndex >= 0) return pendingIndex;
  return tasks.length - 1;
};

export interface TaskListProps extends Omit<ComponentProps<typeof TaskListContainer>, 'children'> {
  tasks: TaskListItem[];
  hideWhenComplete?: boolean;
  scrollActiveIntoView?: boolean;
  defaultOpen?: boolean;
}

export const TaskList = ({
  tasks,
  hideWhenComplete = true,
  scrollActiveIntoView = true,
  defaultOpen = true,
  className,
  ...props
}: TaskListProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const listId = useId();
  const completed = tasks.filter(task => task.status === 'completed').length;
  const total = tasks.length;
  const focusIndex = focusedTaskIndex(tasks);
  const windowHeight = taskWindowHeight(total, open);
  const { viewportRef, glideForOpen } = useFocusedRowScroll({
    focusIndex,
    rowCount: total,
    open,
    followFocus: scrollActiveIntoView,
  });

  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    glideForOpen(nextOpen);
  };

  if (total === 0 || (hideWhenComplete && completed === total)) return null;

  return (
    <TaskListContainer
      aria-label="Task list"
      data-testid="task-list"
      data-collapsed={open ? undefined : ''}
      onClick={open ? undefined : () => changeOpen(true)}
      className={cn('group/task-list relative', !open && 'cursor-pointer', className)}
      {...props}
    >
      <ScrollArea
        id={listId}
        maxHeight={`${windowHeight + 2 * LIST_INSET_Y}px`}
        mask={false}
        viewPortClassName={cn(
          edgeFades,
          'transition-[max-height,mask-size]',
          taskGraphMotion,
          open ? edgeFadesWhenScrolled : 'overflow-hidden!',
        )}
        viewportRef={viewportRef}
      >
        <div className="px-3" style={{ paddingBlock: LIST_INSET_Y }}>
          <div className="relative">
            <TaskGraphLines statuses={tasks.map(task => task.status)} singleLane={!open} />
            <ul>
              {tasks.map((task, index) => {
                const clippedAway = !open && index !== focusIndex;
                return <TaskListRow key={task.id} task={task} inert={clippedAway} aria-hidden={clippedAway} />;
              })}
            </ul>
          </div>
        </div>
      </ScrollArea>
      <div className="absolute top-2.5 right-3 flex h-7 items-center bg-linear-to-r from-transparent to-card to-[1.5rem] pl-6">
        <div
          inert={open}
          aria-hidden={open}
          className={cn(
            'grid transition-[grid-template-columns,opacity]',
            taskGraphMotion,
            open ? 'grid-cols-[0fr] opacity-0' : 'grid-cols-[1fr] opacity-100',
          )}
        >
          <div className="min-w-0 overflow-hidden">
            <TaskListProgress tasks={tasks} className="mr-2" />
          </div>
        </div>
        <button
          type="button"
          aria-label="Show all tasks"
          aria-expanded={open}
          aria-controls={listId}
          onClick={event => {
            event.stopPropagation();
            changeOpen(!open);
          }}
          className={cn(
            'grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground',
            transitions.colors,
            focusRing.visible,
            !open && 'group-hover/task-list:text-foreground',
          )}
        >
          <ChevronDown
            className={cn('size-3.5 transition-[rotate]', taskGraphMotion, open ? 'rotate-180' : 'rotate-0')}
          />
        </button>
      </div>
    </TaskListContainer>
  );
};
