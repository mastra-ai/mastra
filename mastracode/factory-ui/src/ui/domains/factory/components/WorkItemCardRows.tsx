import { knownExternalAuthor } from '@mastra/factory/rules/types';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

import type { BoardCardStatus } from '../boardCardStatus';
import type { CardAction } from '../cardPrimaryAction';
import { metadataLabelColors, metadataLabels, pullRequestStatusForItem, workItemMeta } from '../boardItems';
import { itemStageLabel } from '../boardStages';
import type { AuditActorProfile } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import { CardActions, CardLabels, CardStatus, SourceTitle } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { WorkItemActivity } from './WorkItemActivity';
import { Txt } from '@mastra/playground-ui/components/Txt';
export function WorkItemCardRows({
  item,
  columnStage,
  titleId,
  relatedLinks,
  activity,
  actors,
  status,
  actions,
  beforeStart,
  controls,
  open,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  titleId?: string;
  relatedLinks: ReactNode;
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  status: BoardCardStatus;
  actions: CardAction[];
  beforeStart?: () => void;
  controls: ReactNode;
  open: boolean;
}) {
  const labels = metadataLabels(item.metadata);
  const labelColors = metadataLabelColors(item.metadata);
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const external = knownExternalAuthor(item);
  const verdict = columnStage === 'review' ? reviewVerdict(item.metadata) : undefined;

  return (
    <>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">{controls}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className={cn('flex min-w-0 items-center gap-1.5', open ? 'pr-44' : 'pr-16')}>
          <Txt as="span" variant="meta" tone="faint" className="min-w-0 truncate">
            {workItemMeta(item)}
          </Txt>
          {relatedLinks}
          {item.commentCount > 0 && (
            <Txt
              as="span"
              variant="meta"
              tone="faint"
              className="flex shrink-0 items-center gap-1"
              aria-label={`${item.commentCount} ${item.commentCount === 1 ? 'comment' : 'comments'}`}
            >
              <MessageSquare size={11} aria-hidden />
              {item.commentCount}
            </Txt>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {item.source === 'github-pr' ? (
            <PullRequestStatusIcon status={pullRequestStatusForItem(item)} />
          ) : (
            <SourceIcon source={item.source} />
          )}
          <Txt as="span" variant="card-title-tight" tone="ink" className="min-w-0 flex-1 truncate">
            <SourceTitle source={item.source} title={item.title} id={titleId} />
          </Txt>
        </div>
      </div>
      <CardLabels labels={labels} colors={labelColors} />
      {otherStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {otherStages.map(stage => (
            <Txt
              as="span"
              variant="meta"
              tone="muted"
              key={stage}
              className="border-border rounded-full border px-2 py-0.5"
            >
              {itemStageLabel(item, stage)}
            </Txt>
          ))}
        </div>
      )}
      {(status.kind !== 'idle' || external || verdict) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <CardStatus status={status} />
          {verdict && (
            <Badge size="xs" variant={verdict.approved ? 'green' : 'orange'}>
              {verdict.label}
            </Badge>
          )}
          {external && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge size="xs" tabIndex={0} className="relative z-10 ml-auto">
                    External
                  </Badge>
                }
              />
              <TooltipContent side="bottom" className="max-w-64">
                From someone without write access — never starts a run on its own, even with auto-start runs on.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <CardActions
        actions={actions}
        beforeStart={beforeStart}
        trailing={<WorkItemActivity activity={activity} actors={actors} />}
      />
    </>
  );
}

export function reviewVerdict(metadata: Record<string, unknown>): { approved: boolean; label: string } | undefined {
  const verdict = metadata.reviewVerdict;
  if (verdict !== 'approve' && verdict !== 'request changes') return undefined;
  const sha = typeof metadata.reviewedHeadSha === 'string' ? ` · ${metadata.reviewedHeadSha.slice(0, 7)}` : '';
  return verdict === 'approve'
    ? { approved: true, label: `Approved${sha}` }
    : { approved: false, label: `Changes requested${sha}` };
}
