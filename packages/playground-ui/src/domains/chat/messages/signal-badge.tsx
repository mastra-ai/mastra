import type { TaskItem } from '@mastra/core/signals';

import { NotificationSignalNotice } from './notification-signal-notice';
import { formatSignalValue, isRecord, isSignalData, signalContentsToText } from './signal-data';
import type { SignalData } from './signal-data';
import { ChatSignal } from '@/ds/components/ai/chat-event';

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
    const taskSignal = getTaskSignalData(value);
    if (taskSignal) return null;

    const state = getStateLabel(value);
    return <ChatSignal variant="card" kind="state" label={state.id} mode={state.mode} message={text} />;
  }

  if (value.type === 'notification') {
    return <NotificationSignalNotice signal={value} />;
  }

  if (value.type === 'reactive') {
    return <ChatSignal variant="card" kind="reactive" label={value.tagName ?? 'Signal'} message={text} />;
  }

  return null;
};
