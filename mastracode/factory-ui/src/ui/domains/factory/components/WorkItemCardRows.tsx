import { Badge } from '@mastra/playground-ui/components/Badge';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import type { BoardCardStatus } from '../boardCardState';
import type { CardAction } from '../cardPrimaryAction';
import { workItemMeta } from '../boardItems';
import { itemStageLabel } from '../boardStages';
import { reviewVerdict, selfReviewVerdict } from '../reviewVerdict';
import type { ReviewVerdict } from '../reviewVerdict';
import type { AuditActorProfile } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import {
  CardActions,
  CardStatus,
  CommentCount,
  MetadataLabels,
  SourceTitle,
  WorkItemSourceIcon,
} from './BoardCardParts';
import { WorkItemActivity } from './WorkItemActivity';
import { Txt } from '@mastra/playground-ui/components/Txt';

// The card and its open copy render these same rows, so opening moves none of them.
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
  /** Bottom left, the likeliest first. */
  actions: CardAction[];
  beforeStart?: () => void;
  /** The top-right group: the card's menu, or the copy's link, collapse and menu. */
  controls: ReactNode;
  /** The copy: its labelled source link and two controls to clear. */
  open: boolean;
}) {
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const verdict = columnReviewVerdict(item, columnStage);

  return (
    <>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">{controls}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className={cn('flex min-w-0 items-center gap-1.5', open ? 'pr-44' : 'pr-16')}>
          <Txt as="span" variant="meta" tone="faint" className="min-w-0 truncate">
            {workItemMeta(item)}
          </Txt>
          {relatedLinks}
          <CommentCount count={item.commentCount} />
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <WorkItemSourceIcon item={item} />
          <Txt as="span" variant="card-title-tight" tone="ink" className="min-w-0 flex-1 truncate">
            <SourceTitle source={item.source} title={item.title} id={titleId} />
          </Txt>
        </div>
      </div>
      <MetadataLabels metadata={item.metadata} />
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
      {(status.kind !== 'idle' || verdict) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <CardStatus status={status} />
          {verdict && <ReviewVerdictBadge verdict={verdict} />}
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

export function columnReviewVerdict(item: WorkItem, columnStage: BoardStageId) {
  if (columnStage === 'review') return reviewVerdict(item.metadata) ?? selfReviewVerdict(item.metadata);
  if (columnStage === 'execute') return selfReviewVerdict(item.metadata);
  return undefined;
}

export function ReviewVerdictBadge({ verdict }: { verdict: ReviewVerdict }) {
  return (
    <Badge
      size="xs"
      variant={verdict.outdated ? 'neutral' : verdict.approved ? 'green' : 'orange'}
      className="min-w-0"
      title={verdict.label}
    >
      <span className="truncate">{verdict.label}</span>
    </Badge>
  );
}
