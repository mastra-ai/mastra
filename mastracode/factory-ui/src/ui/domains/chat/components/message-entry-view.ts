import { parseSkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';
import type { SkillActivation } from '@mastra/playground-ui/domains/chat/messages/skill-activation';

import type { MessageEntry, NotificationEntry, NotificationSummaryEntry } from '../services/transcript';
import { isRecord } from './transcript-shared';
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

type StatusPart = Record<string, unknown> & { type: string };

function isStatusPart(part: unknown): part is StatusPart {
  if (!isRecord(part) || typeof part.type !== 'string') return false;
  return part.type === 'notification_summary' || part.type === 'harness-error' || part.type.startsWith('om_');
}

function statusMetadata(entry: MessageEntry): StatusMetadata | undefined {
  const harnessContent = entry.message.content.metadata?.harnessContent;
  if (!Array.isArray(harnessContent)) return undefined;
  const statusPart = harnessContent.find(isStatusPart);
  if (!statusPart) return undefined;

  const text = [statusPart.text, statusPart.message].find(value => typeof value === 'string');
  return {
    id: `${entry.id}-${statusPart.type}`,
    text: text ?? '',
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

function skillActivation(entry: MessageEntry, parts: readonly MessagePart[]): SkillActivation | undefined {
  if (entry.message.role !== 'user') return skillSignalActivation(entry);
  const [onlyPart] = parts;
  if (parts.length !== 1 || onlyPart?.type !== 'text') return undefined;
  return parseSkillActivation(onlyPart.text);
}

function signalView(row: SignalRowView): MessageEntryView {
  if (row.kind === 'state' && SUPPRESSED_STATE_SIGNAL_IDS.has(row.stateId)) return { kind: 'hidden' };
  if (row.kind !== 'reactive') return { kind: 'signal', row };
  const { tagName } = row;
  if (!tagName || HIDDEN_REACTIVE_SIGNAL_TAGS.has(tagName)) return { kind: 'hidden' };
  return { kind: 'signal', row: { ...row, tagName } };
}

/** How an entry draws, before its parts: a dedicated row, nothing, or its parts. */
export function messageEntryView(entry: MessageEntry, parts: readonly MessagePart[]): MessageEntryView {
  const activation = skillActivation(entry, parts);
  if (activation) return { kind: 'skill', activation };
  if (isSkillNotificationSignal(entry)) return { kind: 'hidden' };

  const notifications = notificationMetadata(entry);
  if (notifications.length > 0) return { kind: 'notifications', notifications };

  const row = signalRowView(entry);
  if (row) return signalView(row);

  const status = statusMetadata(entry);
  if (status?.text.trim()) return { kind: 'status', status };
  return { kind: 'parts' };
}
