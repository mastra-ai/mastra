import type { TaskItem } from '@mastra/core/signals';
import { Database, Radio } from 'lucide-react';

import { NotificationSignalNotice } from './notification-signal-notice';
import { formatSignalValue, isRecord, isSignalData, signalContentsToText } from './signal-data';
import type { SignalData } from './signal-data';

export type SignalBadgeProps = {
  signal: unknown;
};

const getStateLabel = (signal: SignalData) => {
  const state = isRecord(signal.metadata?.state) ? signal.metadata.state : undefined;
  return {
    id: formatSignalValue(state?.id) ?? formatSignalValue(signal.attributes?.id) ?? 'State signal',
    mode: formatSignalValue(state?.mode) ?? formatSignalValue(signal.attributes?.mode),
  };
};

const Pill = ({ children }: { children: string }) => (
  <span className="border-border1 text-neutral4 inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs leading-none">
    {children}
  </span>
);

function isTaskItemArray(value: unknown): value is TaskItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      item =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.content === 'string' &&
        (item.status === 'pending' || item.status === 'in_progress' || item.status === 'completed') &&
        typeof item.activeForm === 'string',
    )
  );
}

function getTaskSignalData(signal: SignalData): TaskItem[] | undefined {
  const isTaskSignal =
    signal.id === 'tasks' || signal.tagName === 'current-task-list' || signal.tagName === 'task-list-update';
  if (!isTaskSignal) return undefined;

  const metadata = signal.metadata;
  const value = isRecord(metadata?.value) ? metadata.value : undefined;
  const tasks = value?.tasks;
  if (!isTaskItemArray(tasks)) return undefined;

  return tasks;
}

export const SignalBadge = ({ signal: value }: SignalBadgeProps) => {
  if (!isSignalData(value)) return null;

  const text = signalContentsToText(value.contents);

  if (value.type === 'state') {
    // Task signals are rendered in the docked TaskPanel (bottom of chat) instead
    // of inline to avoid repetition. Hide them here.
    const taskSignal = getTaskSignalData(value);
    if (taskSignal) return null;

    const state = getStateLabel(value);
    return (
      <div className="border-border1 bg-surface2 text-neutral5 my-2 max-w-[80%] rounded-lg border px-4 py-3">
        <div className="flex items-start gap-3">
          <Database className="text-icon3 mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ui-sm leading-ui-sm text-neutral6 font-medium">{state.id}</p>
              {state.mode ? <Pill>{state.mode}</Pill> : null}
            </div>
            {text ? <p className="text-ui-sm leading-ui-md mt-2 break-words whitespace-pre-wrap">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (value.type === 'notification') {
    return <NotificationSignalNotice signal={value} />;
  }

  if (value.type === 'reactive') {
    return (
      <div className="border-border1 bg-surface2 text-neutral5 my-2 max-w-[80%] rounded-lg border px-4 py-3">
        <div className="flex items-start gap-3">
          <Radio className="text-icon3 mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-ui-sm leading-ui-sm text-neutral6 font-medium">{value.tagName ?? 'Signal'}</p>
            {text ? <p className="text-ui-sm leading-ui-md mt-2 break-words whitespace-pre-wrap">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
