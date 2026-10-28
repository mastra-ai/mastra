import type { TaskItem } from '@mastra/core/signals';

import { NotificationSignalNotice } from './notification-signal-notice';
import { formatSignalValue, isRecord, isSignalData, signalContentsToText } from './signal-data';
import type { SignalData } from './signal-data';
import { parseSkillBody } from './skill-activation';
import { SkillMessage } from './skill-message';
import { SignalActivity } from '@/ds/components/ai/activity';

export type SignalBadgeProps = {
  signal: unknown;
  defaultOpen?: boolean;
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

/** A typed skill signal (`tagName: 'skill'`, skill name in `attributes.name`), parsed into its activation. */
function getSkillActivation(signal: SignalData, text: string) {
  if (signal.tagName !== 'skill') return undefined;
  const name = formatSignalValue(signal.attributes?.name);
  return name ? parseSkillBody(name, text) : undefined;
}

export const SignalBadge = ({ signal: value, defaultOpen }: SignalBadgeProps) => {
  if (!isSignalData(value)) return null;

  const text = signalContentsToText(value.contents);

  if (value.type === 'state') {
    if (getTaskSignalData(value)) return null;

    const state = getStateLabel(value);
    return <SignalActivity kind="state" label={state.id} mode={state.mode} message={text} defaultOpen={defaultOpen} />;
  }

  if (value.type === 'notification') return <NotificationSignalNotice signal={value} defaultOpen={defaultOpen} />;

  if (value.type === 'reactive') {
    const skill = getSkillActivation(value, text);
    if (skill) return <SkillMessage activation={skill} defaultOpen={defaultOpen} />;
    return (
      <SignalActivity kind="reactive" label={value.tagName ?? 'Signal'} message={text} defaultOpen={defaultOpen} />
    );
  }

  return null;
};
