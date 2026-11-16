import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { ReactNode } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import type { BoardCardStatus } from '../boardCardState';
import { boardLoop, boardOf } from '../boardFlow';
import type { BoardInfo } from '../boardFlow';
import type { CardAction } from '../cardPrimaryAction';
import { sourceMetadata } from '../boardItems';
import { phaseLabel } from '../boardStages';
import { reviewVerdict, selfReviewVerdict } from '../reviewVerdict';
import { reasonSummary } from '../reworkReason';
import type { ReworkReason } from '../reworkReason';
import type { ReviewVerdict } from '../reviewVerdict';
import { useBoardRepository } from '../hooks/useBoardRepository';
import type { AuditActorProfile } from '../services/audit';
import { workItemMeta } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import {
  CardActions,
  CardStatus,
  MetadataLabels,
  SessionBadge,
  SourceTitle,
  WorkItemSourceIcon,
} from './BoardCardParts';
import { WorkItemActivity } from './WorkItemActivity';
import { SourceStateBadge } from './SourceStateBadge';
import { WorkItemUpstreamLinks } from './WorkItemUpstreamLinks';
import { Txt } from '@mastra/playground-ui/components/Txt';

export function WorkItemCardRows({
  item,
  columnStage,
  relatedLinks,
  activity,
  actors,
  status,
  actions,
  hasSession,
  controls,
  rework,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  relatedLinks: ReactNode;
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  status: BoardCardStatus;
  /** Bottom left, the likeliest first. */
  actions: CardAction[];
  hasSession: boolean;
  /** The top-right group: the card's menu. */
  controls: ReactNode;
  rework?: ReworkReason;
}) {
  const board = boardOf(useBoardCatalog(item.githubProjectId).data, item);
  const repository = useBoardRepository(item.githubProjectId);
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const verdict = columnReviewVerdict(item, columnStage, board);

  return (
    <>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">{controls}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5 pr-8">
          <Txt as="span" variant="meta" tone="faint" className="min-w-0 truncate">
            <Metadata singleLine>
              {workItemMeta(item, repository).map((part, index, parts) => (
                <Metadata.Item
                  key={index}
                  className={index === 0 || index === parts.length - 1 ? 'shrink-0' : undefined}
                >
                  {part}
                </Metadata.Item>
              ))}
            </Metadata>
          </Txt>
          {relatedLinks}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <WorkItemSourceIcon item={item} />
          <Txt as="span" variant="card-title-tight" tone="ink" className="min-w-0 flex-1 truncate">
            <SourceTitle source={item.source} title={item.title} />
          </Txt>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden">
        <WorkItemUpstreamLinks item={item} />
        <SourceStateBadge item={item} />
        <MetadataLabels metadata={sourceMetadata(item)} className="max-w-full min-w-0" />
      </div>
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
              {phaseLabel(board, stage)}
            </Txt>
          ))}
        </div>
      )}
      {(status.kind !== 'idle' || hasSession || verdict || rework) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <CardStatus status={status} />
          {hasSession && <SessionBadge />}
          {verdict && <ReviewVerdictBadge verdict={verdict} />}
          {rework && <ReworkLine rework={rework} />}
        </div>
      )}
      <CardActions
        actions={actions}
        trailing={<WorkItemActivity activity={activity} actors={actors} board={board} />}
      />
    </>
  );
}

/** The verdict a column shows: the pull request's in its review, the builder's own in self-review and building. */
export function columnReviewVerdict(item: WorkItem, columnStage: BoardStageId, board: BoardInfo | undefined) {
  const loop = boardLoop(board);
  if (loop === undefined) return undefined;
  if (columnStage === loop.selfReview) return reviewVerdict(item.metadata) ?? selfReviewVerdict(item.metadata);
  if (columnStage === loop.pullRequestReview) return reviewVerdict(item.metadata);
  if (columnStage === loop.build?.phase) return selfReviewVerdict(item.metadata);
  return undefined;
}

/** "Back from Review: <first line of why>", the whole reason on hover. */
export function ReworkLine({ rework }: { rework: ReworkReason }) {
  const text = `Back from ${rework.fromLabel}${rework.reason ? `: ${reasonSummary(rework.reason)}` : ''}`;
  return (
    <Txt
      as="span"
      variant="caption"
      className="text-badge-orange-indicator max-w-full min-w-0 truncate"
      title={rework.reason ?? text}
    >
      {text}
    </Txt>
  );
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
