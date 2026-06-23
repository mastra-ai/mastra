import { Bell, CheckCircle2, Circle, Database, ListChecks, Loader2, Radio } from 'lucide-react';

import { getNotificationMetadata, isRecord, isSignalData } from './signal-data';
import type { SignalData } from './signal-data';

export type SignalBadgeProps = {
  signal: unknown;
};

const contentsToText = (contents: unknown): string => {
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';

  return contents
    .map(part => {
      if (!isRecord(part)) return '';
      return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .filter(Boolean)
    .join('\n');
};

const formatValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const getStateLabel = (signal: SignalData) => {
  const state = isRecord(signal.metadata?.state) ? signal.metadata.state : undefined;
  return {
    id: formatValue(state?.id) ?? formatValue(signal.attributes?.id) ?? 'State signal',
    mode: formatValue(state?.mode) ?? formatValue(signal.attributes?.mode),
  };
};

const getNotificationTitle = (signal: SignalData) => {
  const notification = getNotificationMetadata(signal);
  if (notification?.signal === 'summary' || signal.tagName === 'notification-summary') return 'Notification summary';
  const source = notification?.source ?? formatValue(signal.attributes?.source);
  const kind = notification?.kind ?? formatValue(signal.attributes?.kind);
  if (source && kind) return `${source} / ${kind}`;
  return source ?? kind ?? 'Notification';
};

const getToneClass = (priority: string | undefined) => {
  switch (priority) {
    case 'urgent':
      return 'border-red-500/40 bg-red-500/10 text-red-200';
    case 'high':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100';
    case 'medium':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-100';
    default:
      return 'border-border1 bg-surface2 text-neutral5';
  }
};

const Pill = ({ children }: { children: string }) => (
  <span className="inline-flex items-center rounded-full border border-border1 px-1.5 py-0.5 text-xs leading-none text-neutral4">
    {children}
  </span>
);

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

function getTaskSignalData(signal: SignalData): { tasks: TaskItem[]; mode: 'snapshot' | 'delta' } | undefined {
  const isTaskSignal =
    signal.id === 'tasks' || signal.tagName === 'current-task-list' || signal.tagName === 'task-list-update';
  if (!isTaskSignal) return undefined;

  const metadata = signal.metadata;
  const value = isRecord(metadata?.value) ? metadata.value : undefined;
  const tasks = value?.tasks;
  if (!isTaskItemArray(tasks)) return undefined;

  const mode = signal.tagName === 'task-list-update' ? 'delta' : 'snapshot';
  return { tasks, mode };
}

const taskStatusIcon: Record<TaskItem['status'], React.ReactNode> = {
  completed: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />,
  in_progress: <Loader2 className="h-3.5 w-3.5 shrink-0 text-yellow-500 animate-spin" />,
  pending: <Circle className="h-3.5 w-3.5 shrink-0 text-neutral4" />,
};

const taskStatusTextClass: Record<TaskItem['status'], string> = {
  completed: 'text-neutral4 line-through',
  in_progress: 'text-yellow-500 font-medium',
  pending: 'text-neutral5',
};

const TaskSignalBadge = ({ tasks, mode }: { tasks: TaskItem[]; mode: 'snapshot' | 'delta' }) => {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const allDone = completed === total;

  return (
    <div className="my-2 max-w-[80%] rounded-lg border border-border1 bg-surface2 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <ListChecks className={`h-4 w-4 shrink-0 ${allDone ? 'text-green-500' : 'text-icon3'}`} />
        <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">Tasks</p>
        {mode === 'delta' && <Pill>update</Pill>}
        <span className="text-ui-xs leading-ui-xs text-neutral4 ml-auto tabular-nums">
          {completed}/{total}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-surface4 mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-green-500' : 'bg-accent6'}`}
          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
        />
      </div>
      <ul className="space-y-1">
        {tasks.map(task => (
          <li key={task.id} className="flex items-start gap-2 py-0.5">
            {taskStatusIcon[task.status]}
            <span className={`text-ui-sm leading-ui-sm ${taskStatusTextClass[task.status]}`}>
              {task.status === 'in_progress' ? task.activeForm : task.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const SignalBadge = ({ signal: value }: SignalBadgeProps) => {
  if (!isSignalData(value)) return null;

  const text = contentsToText(value.contents);

  if (value.type === 'state') {
    const taskSignal = getTaskSignalData(value);
    if (taskSignal) return <TaskSignalBadge tasks={taskSignal.tasks} mode={taskSignal.mode} />;

    const state = getStateLabel(value);
    return (
      <div className="my-2 max-w-[80%] rounded-lg border border-border1 bg-surface2 px-4 py-3 text-neutral5">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-icon3" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">{state.id}</p>
              {state.mode ? <Pill>{state.mode}</Pill> : null}
            </div>
            {text ? <p className="mt-2 whitespace-pre-wrap break-words text-ui-sm leading-ui-md">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (value.type === 'notification') {
    const notification = getNotificationMetadata(value);
    const priority = notification?.priority ?? formatValue(value.attributes?.priority);
    const pending = formatValue(notification?.pending) ?? formatValue(value.attributes?.pending);
    const status = notification?.status ?? formatValue(value.attributes?.status);
    const toneClass = getToneClass(priority);

    return (
      <div className={`my-2 max-w-[80%] rounded-lg border px-4 py-3 ${toneClass}`}>
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">{getNotificationTitle(value)}</p>
              {priority ? <Pill>{priority}</Pill> : null}
              {status ? <Pill>{status}</Pill> : null}
              {pending ? <Pill>{`${pending} pending`}</Pill> : null}
            </div>
            {text ? <p className="mt-2 whitespace-pre-wrap break-words text-ui-sm leading-ui-md">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (value.type === 'reactive') {
    return (
      <div className="my-2 max-w-[80%] rounded-lg border border-border1 bg-surface2 px-4 py-3 text-neutral5">
        <div className="flex items-start gap-3">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-icon3" />
          <div className="min-w-0 flex-1">
            <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">{value.tagName ?? 'Signal'}</p>
            {text ? <p className="mt-2 whitespace-pre-wrap break-words text-ui-sm leading-ui-md">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
