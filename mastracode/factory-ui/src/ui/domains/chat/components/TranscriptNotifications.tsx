import { ChatNotification } from '@mastra/playground-ui/components/ai/chat-event';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Bell, CircleDot } from 'lucide-react';
import type { ReactNode } from 'react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { MessageEntry, NotificationEntry, NotificationSummaryEntry } from '../services/transcript';
import { parseSkillActivation } from './SkillMessage';
import { isRecord } from './transcript-shared';
import { signalPartsText } from './TranscriptSignals';

/** Where a notification's "Open on …" link points; GitHub and GitLab name the provider. */
export function notificationLinkLabel(entry: Pick<NotificationEntry, 'source'>): string {
  if (entry.source === 'gitlab') return 'Open on GitLab';
  if (entry.source === 'github') return 'Open on GitHub';
  return 'Open notification target';
}

export function notificationUrl(entry: Pick<NotificationEntry, 'source' | 'metadata'>): string | undefined {
  const targetUrl = entry.metadata?.targetUrl;
  if (typeof targetUrl === 'string' && /^https:\/\/github\.com\//.test(targetUrl)) return targetUrl;
  // GitLab instances live on any host, so the server-supplied target is trusted
  // only when it is an https merge-request or issue page.
  if (
    entry.source === 'gitlab' &&
    typeof targetUrl === 'string' &&
    /^https:\/\/[^/\s]+\/.+\/-\/(merge_requests|issues)\/\d+/.test(targetUrl)
  ) {
    return targetUrl;
  }

  const repository = entry.metadata?.repository;
  if (typeof repository !== 'string' || !/^[^/]+\/[^/]+$/.test(repository)) return undefined;
  const pullRequestNumber = entry.metadata?.pullRequestNumber;
  if (typeof pullRequestNumber === 'number') return `https://github.com/${repository}/pull/${pullRequestNumber}`;
  const issueNumber = entry.metadata?.issueNumber;
  if (typeof issueNumber === 'number') return `https://github.com/${repository}/issues/${issueNumber}`;
  return undefined;
}

function notificationPresentation(entry: NotificationEntry): { state: string; icon: ReactNode; className?: string } {
  const action = entry.metadata?.action;
  if (entry.notifKind === 'pull-request-merged') {
    return { state: 'merged', icon: <PullRequestStatusIcon status="merged" size={13} decorative /> };
  }
  if (entry.notifKind === 'pull-request-closed') {
    return { state: 'closed', icon: <PullRequestStatusIcon status="closed" size={13} decorative /> };
  }
  if (action === 'opened' || action === 'reopened') {
    return { state: 'open', icon: <CircleDot size={13} />, className: 'text-accent1' };
  }
  return { state: 'notification', icon: <Bell size={13} />, className: 'text-warning1' };
}

export function NotificationCard({ entry }: { entry: NotificationEntry }) {
  const presentation = notificationPresentation(entry);
  const url = notificationUrl(entry);
  return (
    <ChatNotification
      state={presentation.state}
      label={entry.source ?? 'notification'}
      message={entry.message}
      icon={<span className={cn('flex items-center', presentation.className)}>{presentation.icon}</span>}
      link={url ? { href: url, label: notificationLinkLabel(entry) } : undefined}
    />
  );
}

export function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return <ChatNotification state="summary" label="Notification summary" message={entry.message} />;
}

export function notificationMetadata(entry: MessageEntry): Array<NotificationEntry | NotificationSummaryEntry> {
  if (entry.message.role === 'signal') return signalNotifications(entry);

  const harnessContent = entry.message.content.metadata?.harnessContent;
  if (!Array.isArray(harnessContent)) return [];

  const notifications: Array<NotificationEntry | NotificationSummaryEntry> = [];
  for (const [index, part] of harnessContent.entries()) {
    if (typeof part !== 'object' || part === null || !('type' in part)) continue;
    if (!('message' in part) || typeof part.message !== 'string') continue;

    if (part.type === 'notification') {
      notifications.push({
        kind: 'notification',
        id: `${entry.id}-notification-${index}`,
        notificationId:
          'notificationId' in part && typeof part.notificationId === 'string' ? part.notificationId : undefined,
        message: part.message,
        source: 'source' in part && typeof part.source === 'string' ? part.source : undefined,
        notifKind: 'kind' in part && typeof part.kind === 'string' ? part.kind : undefined,
        priority: 'priority' in part && typeof part.priority === 'string' ? part.priority : undefined,
        metadata: 'metadata' in part && isRecord(part.metadata) ? part.metadata : undefined,
      });
      continue;
    }

    if (part.type !== 'notification_summary') continue;
    const pending = 'pending' in part && typeof part.pending === 'number' ? part.pending : 0;
    const bySource = 'bySource' in part && isNumberRecord(part.bySource) ? part.bySource : {};
    const byPriority = 'byPriority' in part && isNumberRecord(part.byPriority) ? part.byPriority : {};
    const notificationIds =
      'notificationIds' in part && Array.isArray(part.notificationIds)
        ? part.notificationIds.filter((id: unknown): id is string => typeof id === 'string')
        : [];
    notifications.push({
      kind: 'notification_summary',
      id: `${entry.id}-notification-summary-${index}`,
      message: part.message,
      pending,
      bySource,
      byPriority,
      notificationIds,
    });
  }
  return notifications;
}

export function isSkillNotificationSignal(entry: MessageEntry): boolean {
  if (entry.message.role !== 'signal') return false;
  const signal = entry.message.content.metadata?.signal;
  return isRecord(signal) && signal.type === 'notification' && Boolean(parseSkillActivation(signalPartsText(entry)));
}

function signalNotifications(entry: MessageEntry): Array<NotificationEntry | NotificationSummaryEntry> {
  const signal = entry.message.content.metadata?.signal;
  if (!isRecord(signal) || signal.type !== 'notification') return [];
  if (isSkillNotificationSignal(entry)) return [];

  const text = signalPartsText(entry);
  const attributes = isRecord(signal.attributes) ? signal.attributes : {};
  const metadata = isRecord(signal.metadata) ? signal.metadata : {};

  if (signal.tagName === 'notification-summary') {
    const summary = isRecord(metadata.notificationSummary) ? metadata.notificationSummary : {};
    return [
      {
        kind: 'notification_summary',
        id: `${entry.id}-signal-summary`,
        message: text,
        pending: typeof summary.pending === 'number' ? summary.pending : 0,
        bySource: isNumberRecord(summary.bySource) ? summary.bySource : {},
        byPriority: isNumberRecord(summary.byPriority) ? summary.byPriority : {},
        notificationIds: Array.isArray(summary.notificationIds)
          ? summary.notificationIds.filter((id: unknown): id is string => typeof id === 'string')
          : [],
      },
    ];
  }

  return [
    {
      kind: 'notification',
      id: `${entry.id}-signal-notification`,
      notificationId: typeof attributes.id === 'string' ? attributes.id : undefined,
      message: text,
      source: typeof attributes.source === 'string' ? attributes.source : undefined,
      notifKind: typeof attributes.kind === 'string' ? attributes.kind : undefined,
      priority: typeof attributes.priority === 'string' ? attributes.priority : undefined,
      metadata,
    },
  ];
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(candidate => typeof candidate === 'number')
  );
}
