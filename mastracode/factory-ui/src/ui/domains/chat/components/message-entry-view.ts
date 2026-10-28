import { parseSkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';
import type { SkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';

import type { MessageEntry, NotificationEntry, NotificationSummaryEntry } from '../services/transcript';
import type { MessagePart } from './transcript-parts';
import { isSkillNotificationSignal, notificationMetadata } from './TranscriptNotifications';
import {
  HIDDEN_REACTIVE_SIGNAL_TAGS,
  signalRowView,
  skillSignalActivation,
  SUPPRESSED_STATE_SIGNAL_IDS,
} from './TranscriptSignals';
import type { SignalRowView } from './TranscriptSignals';

export interface StatusMetadata {
  id: string;
  text: string;
  level: 'info' | 'error';
}

export function statusMetadata(entry: MessageEntry): StatusMetadata | undefined {
  const harnessContent = entry.message.content.metadata?.harnessContent;
  if (!Array.isArray(harnessContent)) return undefined;

  const statusPart = harnessContent.find(
    part =>
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      typeof part.type === 'string' &&
      (part.type === 'notification_summary' || part.type.startsWith('om_') || part.type === 'harness-error'),
  );
  if (!statusPart || typeof statusPart !== 'object' || !('type' in statusPart)) return undefined;

  const text =
    'text' in statusPart && typeof statusPart.text === 'string'
      ? statusPart.text
      : 'message' in statusPart && typeof statusPart.message === 'string'
        ? statusPart.message
        : '';
  return {
    id: `${entry.id}-${String(statusPart.type)}`,
    text,
    level: statusPart.type === 'harness-error' ? 'error' : 'info',
  };
}

type ReactiveRow = Extract<SignalRowView, { kind: 'reactive' }>;
export type DrawnSignalRow = Exclude<SignalRowView, ReactiveRow> | (ReactiveRow & { tagName: string });

export type MessageEntryView =
  | { kind: 'skill'; activation: SkillActivation }
  | { kind: 'hidden' }
  | { kind: 'notifications'; notifications: Array<NotificationEntry | NotificationSummaryEntry> }
  | { kind: 'signal'; row: DrawnSignalRow }
  | { kind: 'status'; status: StatusMetadata }
  | { kind: 'parts' };

/** How an entry draws, before its parts: a dedicated row, nothing, or its parts. */
export function messageEntryView(entry: MessageEntry, parts: readonly MessagePart[]): MessageEntryView {
  const onlyPart = parts.length === 1 ? parts[0] : undefined;
  const activation =
    entry.message.role === 'user'
      ? onlyPart?.type === 'text'
        ? parseSkillActivation(onlyPart.text)
        : undefined
      : skillSignalActivation(entry);
  if (activation) return { kind: 'skill', activation };
  if (isSkillNotificationSignal(entry)) return { kind: 'hidden' };

  const notifications = notificationMetadata(entry);
  if (notifications.length > 0) return { kind: 'notifications', notifications };

  const row = signalRowView(entry);
  if (row) {
    if (row.kind === 'state')
      return SUPPRESSED_STATE_SIGNAL_IDS.has(row.stateId) ? { kind: 'hidden' } : { kind: 'signal', row };
    if (row.kind !== 'reactive') return { kind: 'signal', row };
    const { tagName } = row;
    if (!tagName || HIDDEN_REACTIVE_SIGNAL_TAGS.has(tagName)) return { kind: 'hidden' };
    return { kind: 'signal', row: { ...row, tagName } };
  }

  const status = statusMetadata(entry);
  if (status?.text.trim()) return { kind: 'status', status };
  return { kind: 'parts' };
}
