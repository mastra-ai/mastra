import {
  notificationLinkLabel,
  notificationMetadata,
  notificationSourceName,
  notificationUrl,
  isSkillNotificationSignal,
} from '@mastra/playground-ui/domains/chat/transcript/components/notifications';
import {
  Activity,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
  NotificationActivity,
} from '@mastra/playground-ui/components/ai/activity';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleDotIcon } from '@mastra/playground-ui/icons/CircleDotIcon';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useSessionActivityQuery } from '../../../../hooks/useSessionRows';
import { invalidateSessionQueries } from '../../../../hooks/useWorkspaces';
import { threadPath } from '../../workspaces/services/factoryPaths';
import { answerParkedApproval } from '../../workspaces/services/user-sessions';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { NotificationEntry, NotificationSummaryEntry } from '../services/transcript';
import { IconBell2 } from '@mastra/playground-ui/icons/central/IconBell2';

/** Where a notification's "Open on …" link points; GitHub and GitLab name the provider. */
function notificationPresentation(entry: NotificationEntry): { state: string; icon: ReactNode; className?: string } {
  const action = entry.metadata?.action;
  if (entry.notifKind === 'pull-request-merged') {
    return { state: 'merged', icon: <PullRequestStatusIcon status="merged" decorative /> };
  }
  if (entry.notifKind === 'pull-request-closed') {
    return { state: 'closed', icon: <PullRequestStatusIcon status="closed" decorative /> };
  }
  if (action === 'opened' || action === 'reopened') {
    return { state: 'open', icon: <CircleDotIcon />, className: 'text-success-indicator' };
  }
  return { state: 'notification', icon: <IconBell2 />, className: 'text-warning-foreground' };
}

export function NotificationCard({ entry }: { entry: NotificationEntry }) {
  const presentation = notificationPresentation(entry);
  const url = notificationUrl(entry);
  const { factoryId } = useParams<{ factoryId: string }>();
  const waiting = waitingSession(entry);
  const activity = (
    <NotificationActivity
      state={presentation.state}
      label={entry.source ?? 'notification'}
      message={entry.message}
      icon={<span className={cn('flex items-center', presentation.className)}>{presentation.icon}</span>}
      link={url ? { href: url, label: notificationLinkLabel(entry) } : undefined}
    />
  );
  if (!waiting || !factoryId) return activity;
  return (
    <div className="flex flex-col gap-1.5">
      {activity}
      <WaitingSessionActions factoryId={factoryId} waiting={waiting} />
    </div>
  );
}

/** The session a notification says is waiting on someone, and the call a yes or no would answer. */
interface WaitingSession {
  sessionId: string;
  threadId: string;
  /** Set when the session waits on a bare yes or no; a typed answer is given in the session itself. */
  toolCallId?: string;
}

function waitingSession(entry: NotificationEntry): WaitingSession | undefined {
  if (entry.notifKind !== 'approval' && entry.notifKind !== 'blocked') return undefined;
  const sessionId = entry.attributes?.['from-session'];
  if (typeof sessionId !== 'string' || !sessionId) return undefined;
  const threadId = entry.attributes?.['from-thread'];
  const toolCallId = entry.attributes?.['tool-call-id'];
  return {
    sessionId,
    threadId: typeof threadId === 'string' && threadId ? threadId : sessionId,
    ...(entry.attributes?.['waiting-for'] === 'approval' && typeof toolCallId === 'string' && toolCallId
      ? { toolCallId }
      : {}),
  };
}

/**
 * Opens the waiting session, and answers its call from here where a yes or no is all it needs.
 * The server decides who may answer; its refusal is shown in place of the buttons.
 */
function WaitingSessionActions({ factoryId, waiting }: { factoryId: string; waiting: WaitingSession }) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const parked = useSessionActivityQuery(factoryId).data?.parkedSessionIds.includes(waiting.sessionId);
  const { toolCallId } = waiting;
  const answer = useMutation({
    mutationKey: ['answer-parked-approval', waiting.sessionId, toolCallId],
    mutationFn: (decision: 'approve' | 'decline') =>
      answerParkedApproval(baseUrl, waiting.sessionId, decision, toolCallId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) });
      void invalidateSessionQueries(queryClient, factoryId);
    },
  });
  const outcome = answer.isSuccess
    ? answer.variables === 'approve'
      ? 'Approved'
      : 'Declined'
    : answer.isError
      ? answer.error.message
      : parked === false
        ? 'Answered'
        : undefined;

  return (
    <div role="group" aria-label="Waiting session" className="flex flex-wrap items-center gap-2 pl-6">
      {toolCallId && !outcome && parked && (
        <>
          <Button
            size="sm"
            variant="primary"
            disabled={answer.isPending}
            loading={answer.isPending && answer.variables === 'approve'}
            onClick={() => answer.mutate('approve')}
          >
            Approve
          </Button>
          <Button
            size="sm"
            disabled={answer.isPending}
            loading={answer.isPending && answer.variables === 'decline'}
            onClick={() => answer.mutate('decline')}
          >
            Decline
          </Button>
        </>
      )}
      {toolCallId && outcome && (
        <Txt variant="caption" tone="muted" role="status">
          {outcome}
        </Txt>
      )}
      <Button size="sm" variant="ghost" render={<Link to={threadPath(factoryId, waiting)} />}>
        Open session
      </Button>
    </div>
  );
}

export function NotificationSummaryCard({ entry }: { entry: NotificationSummaryEntry }) {
  const sources = Object.entries(entry.bySource).filter(([, count]) => count > 0);
  const counted = entry.pending > 0 && sources.length > 0;
  const urgent = (entry.byPriority.urgent ?? 0) > 0 || (entry.byPriority.high ?? 0) > 0;

  return (
    <Activity foldable={false} appearance="inline" data-notification-state="summary" aria-label="Notification summary">
      <ActivityHeader>
        <ActivityIcon className="[&_svg]:size-icon-md">
          <IconBell2 className={cn(urgent && 'text-warning-foreground')} aria-hidden />
        </ActivityIcon>
        <ActivityLabel className="text-subheading">Notifications</ActivityLabel>
        <ActivityLabel wrap className="text-body">
          {counted ? `${entry.pending} new` : entry.message}
        </ActivityLabel>
        {counted &&
          sources.map(([source, count]) => (
            <Badge key={source} size="xs">
              {sources.length > 1 ? `${notificationSourceName(source)} ${count}` : notificationSourceName(source)}
            </Badge>
          ))}
      </ActivityHeader>
    </Activity>
  );
}

export {
  isSkillNotificationSignal,
  notificationLinkLabel,
  notificationMetadata,
  notificationSourceName,
  notificationUrl,
};
