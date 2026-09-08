import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Bell, CircleDot, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { MessageEntry, NotificationEntry, NotificationSummaryEntry } from '../services/transcript';
import { parseSkillActivation } from './SkillMessage';
import { isRecord, truncate } from './transcript-shared';
import { signalPartsText } from './TranscriptSignals';
import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from './TranscriptRow';

function notificationUrl(entry: NotificationEntry): string | undefined {
  const targetUrl = entry.metadata?.targetUrl;
  if (typeof targetUrl === 'string' && /^https:\/\/github\.com\//.test(targetUrl)) return targetUrl;

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

/** Collapsible row mirroring the ToolCard shape: chevron + label + preview + state icon. */
function NotificationRow({
  state,
  label,
  message,
  icon,
  url,
}: {
  state: string;
  label: string;
  message: string;
  icon: ReactNode;
  url?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      data-notification-state={state}
      role="group"
      aria-label={`Notification: ${label}`}
    >
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow icon={icon} label={label} detail={truncate(message, 72)} expanded={expanded} />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={cn(ROW_RAIL, 'flex flex-col gap-2')}>
          <Txt variant="ui-sm">{message}</Txt>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open notification target: ${message}`}
              className="text-ui-xs text-icon3 hover:text-icon5 flex w-fit items-center gap-1"
            >
              Open on GitHub
              <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NotificationCard({ entry }: { entry: NotificationEntry }) {
  const presentation = notificationPresentation(entry);
  return (
    <NotificationRow
      state={presentation.state}
      label={entry.source ?? 'notification'}
      message={entry.message}
      icon={<span className={cn('flex items-center', presentation.className)}>{presentation.icon}</span>}
      url={notificationUrl(entry)}
    />
  );
}

export function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  return (
    <NotificationRow
      state="summary"
      label="Notification summary"
      message={entry.message}
      icon={<Bell size={13} className="text-warning1" />}
    />
  );
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

/**
 * Persisted notification signals are DB-native `role: 'signal'` rows whose
 * original signal payload lives under `content.metadata.signal` (see
 * `signalToDBMessage` in @mastra/core). Rebuild notification cards from it so
 * they survive transcript hydration.
 */
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
