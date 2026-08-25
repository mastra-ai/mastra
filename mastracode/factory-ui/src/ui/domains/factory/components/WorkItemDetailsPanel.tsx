import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight, EllipsisVertical, Minimize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { Link, useParams } from 'react-router';

import type { BoardCardStatus } from '../boardCardStatus';
import { externalLinkLabel, metadataLabels, pullRequestStatusForItem, workItemMeta } from '../boardItems';
import { itemStageLabel } from '../boardStages';
import type { CardPrimaryAction } from '../cardPrimaryAction';
import type { CardMorph } from '../hooks/useCardMorph';
import type { AuditEventPage } from '../services/audit';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { workItemActivity } from '../workItemActivity';
import { CardSourceDescription } from './BoardCardDetails';
import { CardLabels, CardStatus } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { CardDetailsBody, CardDetailsPanel } from './CardDetailsPanel';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { WorkItemActivity } from './WorkItemActivity';

// The header repeats the card rows in the card order, so the box grows around them instead of re-staging them.
export function WorkItemDetailsPanel({
  item,
  columnStage,
  projectRepositoryId,
  activityPage,
  morph,
  relatedLinks,
  threadSession,
  status,
  retryingDecisionId,
  onRetryDecision,
  menu,
  primaryAction,
  runDisabled,
  runPending,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  projectRepositoryId: string;
  activityPage?: AuditEventPage;
  morph: CardMorph;
  relatedLinks: ReactNode;
  threadSession?: WorkItemSessionRef;
  status: BoardCardStatus;
  retryingDecisionId?: string;
  onRetryDecision: (decisionId: string) => void;
  menu: ReactNode;
  primaryAction?: CardPrimaryAction;
  runDisabled: boolean;
  runPending: boolean;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const titleId = useId();

  const labels = metadataLabels(item.metadata);
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const activity = workItemActivity(item, activityPage);
  const retryDecisionId = status.kind === 'error' ? status.retryDecisionId : undefined;

  const startPrimary = () => {
    morph.closeDetails();
    primaryAction?.start();
  };

  return (
    <CardDetailsPanel morph={morph} labelledBy={titleId}>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="text-ui-xs text-icon2 min-w-0 truncate">{workItemMeta(item)}</span>
              {threadSession !== undefined && <span aria-hidden className="bg-accent1 size-2 shrink-0 rounded-full" />}
              {relatedLinks}
            </div>
            {item.url !== null && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label={externalLinkLabel(item.source)}
                className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
              >
                <ArrowUpRight size={13} aria-hidden />
              </a>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Collapse ${item.title}`}
              onClick={morph.closeDetails}
            >
              <Minimize2 size={13} aria-hidden />
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`All actions for ${item.title}`}>
                    <EllipsisVertical size={13} aria-hidden />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end" className="min-w-44">
                {menu}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            {item.source === 'github-pr' ? (
              <PullRequestStatusIcon status={pullRequestStatusForItem(item)} />
            ) : (
              <SourceIcon source={item.source} />
            )}
            <h2 id={titleId} className="text-ui-smd text-icon6 m-0 min-w-0 font-semibold wrap-anywhere">
              {item.title}
            </h2>
          </div>
        </div>
        <CardLabels labels={labels} />
        {otherStages.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {otherStages.map(stage => (
              <span key={stage} className="border-border1 text-ui-xs text-icon4 rounded-full border px-2 py-0.5">
                {itemStageLabel(item, stage)}
              </span>
            ))}
          </div>
        )}
        {(activity.lastWorker !== undefined || status.kind !== 'idle') && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <WorkItemActivity activity={activity} actors={activityPage?.actors ?? {}} />
            {/* No approve button here: the footer's own action releases the same
                suggested run, so the status stays a status. */}
            <CardStatus
              status={status}
              onRetry={retryDecisionId === undefined ? undefined : () => onRetryDecision(retryDecisionId)}
              retrying={retryDecisionId !== undefined && retryDecisionId === retryingDecisionId}
            />
          </div>
        )}
      </div>
      {/* Only what the card never carried is staged in. */}
      <CardDetailsBody>
        <CardSourceDescription
          item={item}
          projectRepositoryId={projectRepositoryId}
          factoryProjectId={factoryId || undefined}
        />
      </CardDetailsBody>
      <div className="flex flex-col gap-2 px-3 py-2.5" data-card-morph="reveal">
        {threadSession !== undefined && (
          <Link
            to={`/factories/${factoryId}/workspaces/${threadSession.sessionId}/threads/${threadSession.threadId}`}
            className={cn(
              buttonVariants({ variant: primaryAction === undefined ? 'primary' : 'outline', size: 'sm' }),
              'w-full',
            )}
          >
            Open session
          </Link>
        )}
        {primaryAction !== undefined && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full"
            disabled={runDisabled || runPending}
            onClick={startPrimary}
          >
            {runPending ? 'Starting…' : primaryAction.label}
          </Button>
        )}
      </div>
    </CardDetailsPanel>
  );
}
