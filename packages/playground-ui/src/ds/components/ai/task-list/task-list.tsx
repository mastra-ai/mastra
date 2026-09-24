import type { TaskItem } from '@mastra/core/signals';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { TaskGraphLines } from './task-graph';
import {
  TASK_ROW_HEIGHT,
  taskGraphLaneShift,
  taskGraphMotion,
  glideScrollTop,
  taskGraphNodeClass,
  useCompletionPulse,
} from './task-graph-node';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { focusRing, transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TaskListItem = TaskItem;

export const TaskListContainer = ({ className, ...props }: ComponentProps<'section'>) => (
  <section className={cn(raisedSurfaceStyle, 'rounded-2xl px-3 py-2.5', className)} {...props} />
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
          'col-start-1 row-start-1 truncate transition-[opacity,color]',
          taskGraphMotion,
          task.status === 'pending' ? 'text-muted-foreground/70' : 'text-muted-foreground',
          active ? 'opacity-0' : 'opacity-100',
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
          'col-start-1 row-start-1 truncate bg-linear-to-r from-accent6 to-foreground to-60% bg-clip-text text-transparent transition-opacity',
          taskGraphMotion,
          active ? 'opacity-100' : 'opacity-0',
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

export const TaskListRow = ({ task, className, style, ...props }: TaskListRowProps) => {
  const pulseRef = useCompletionPulse<HTMLSpanElement>(task.status);
  return (
    <li
      className={cn('relative flex items-center', className)}
      style={{ height: TASK_ROW_HEIGHT, ...style }}
      {...props}
    >
      <TaskListStatusIcon
        ref={pulseRef}
        status={task.status}
        className={cn(taskGraphNodeClass, taskGraphMotion, taskGraphLaneShift[task.status])}
      />
      <span
        className={cn(
          'flex min-w-0 transition-[padding-left]',
          taskGraphMotion,
          task.status === 'in_progress' ? 'pl-12' : 'pl-8',
        )}
      >
        <TaskListLabel task={task} />
      </span>
    </li>
  );
};

const EXPANDED_VISIBLE_ROWS = 4.5;

/* Each fade is a gradient layer 2rem taller than the viewport; sliding it by 2rem pushes the fade out of view, which mask-position can animate. */
const edgeFades =
  'mask-intersect mask-no-repeat [--fade-bottom:0rem] [--fade-top:-2rem] [mask-image:linear-gradient(to_bottom,transparent,black_2rem),linear-gradient(to_top,transparent,black_2rem)] [mask-position:0_var(--fade-top),0_var(--fade-bottom)] [mask-size:100%_calc(100%+2rem)]';
const edgeFadesWhenScrolled = 'data-[overflow-y-end]:[--fade-bottom:-2rem] data-[overflow-y-start]:[--fade-top:0rem]';

const clampScrollTop = (top: number, contentHeight: number, windowHeight: number) =>
  Math.min(Math.max(top, 0), Math.max(contentHeight - windowHeight, 0));

const revealedScrollTop = (rowIndex: number, currentTop: number, windowHeight: number) => {
  const rowTop = rowIndex * TASK_ROW_HEIGHT;
  const rowBottom = rowTop + TASK_ROW_HEIGHT;
  if (rowTop < currentTop) return rowTop;
  if (rowBottom > currentTop + windowHeight) return rowBottom - windowHeight;
  return currentTop;
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const placedOnce = useRef(false);
  const completed = tasks.filter(task => task.status === 'completed').length;
  const total = tasks.length;
  const activeIndex = tasks.findIndex(task => task.status === 'in_progress');
  const pendingIndex = tasks.findIndex(task => task.status === 'pending');
  const focusIndex = activeIndex >= 0 ? activeIndex : pendingIndex >= 0 ? pendingIndex : total - 1;
  const contentHeight = total * TASK_ROW_HEIGHT;
  const windowHeight = open ? Math.min(total, EXPANDED_VISIBLE_ROWS) * TASK_ROW_HEIGHT : TASK_ROW_HEIGHT;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function') return;
    const currentTop = viewport.scrollTop;
    const wantedTop = open
      ? scrollActiveIntoView
        ? revealedScrollTop(focusIndex, currentTop, windowHeight)
        : currentTop
      : focusIndex * TASK_ROW_HEIGHT;
    const top = clampScrollTop(wantedTop, contentHeight, windowHeight);
    if (!placedOnce.current) {
      placedOnce.current = true;
      viewport.scrollTo({ top });
      return;
    }
    if (top !== currentTop) return glideScrollTop(viewport, top);
  }, [open, focusIndex, windowHeight, contentHeight, scrollActiveIntoView]);

  if (total === 0 || (hideWhenComplete && completed === total)) return null;

  return (
    <TaskListContainer
      aria-label="Task list"
      data-testid="task-list"
      onClick={open ? undefined : () => setOpen(true)}
      className={cn('group relative', !open && 'cursor-pointer', className)}
      {...props}
    >
      <ScrollArea
        id={listId}
        maxHeight={`${windowHeight}px`}
        mask={false}
        className="-mr-3"
        viewPortClassName={cn(
          edgeFades,
          'pr-3 transition-[max-height,mask-position]',
          taskGraphMotion,
          open ? edgeFadesWhenScrolled : 'overflow-hidden!',
        )}
        viewportRef={viewportRef}
      >
        <div className="relative">
          <TaskGraphLines
            statuses={tasks.map(task => task.status)}
            className={cn('transition-opacity', taskGraphMotion, open ? 'opacity-100' : 'opacity-0')}
          />
          <ul>
            {tasks.map((task, index) => {
              const clippedAway = !open && index !== focusIndex;
              return <TaskListRow key={task.id} task={task} inert={clippedAway} aria-hidden={clippedAway} />;
            })}
          </ul>
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
            setOpen(current => !current);
          }}
          className={cn(
            'grid size-6 cursor-pointer place-items-center rounded-md text-muted-foreground hover:text-foreground',
            transitions.colors,
            focusRing.visible,
            !open && 'group-hover:text-foreground',
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
