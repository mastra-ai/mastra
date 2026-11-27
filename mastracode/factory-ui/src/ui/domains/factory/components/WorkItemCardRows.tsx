import { useBoardCatalog } from '@mastra/react/hooks/factory';
import { BoardCardRows } from '@mastra/playground-ui/domains/factory';
import { Badge } from '@mastra/playground-ui/components/Badge';
import type { ReactNode } from 'react';

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
import type { WorkItem } from '@internal/factory-contract';
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
import { Txt } from '@mastra/playground-ui/components/Txt';

export function WorkItemCardRows({
  item,
  columnStage,
  relatedLinks,
  upstreamLinks,
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
  upstreamLinks: ReactNode;
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

  const statusRow = (status.kind !== 'idle' || hasSession || verdict || rework) && (
    <>
      <CardStatus status={status} />
      {hasSession && <SessionBadge />}
      {verdict && <ReviewVerdictBadge verdict={verdict} />}
      {rework && <ReworkLine rework={rework} />}
    </>
  );

  return (
    <BoardCardRows
      controls={controls}
      meta={workItemMeta(item, repository)}
      related={relatedLinks}
      icon={<WorkItemSourceIcon item={item} />}
      title={<SourceTitle source={item.source} title={item.title} />}
      details={
        <>
          {upstreamLinks}
          <SourceStateBadge item={item} />
          <MetadataLabels metadata={sourceMetadata(item)} className="max-w-full min-w-0" />
        </>
      }
      otherStages={otherStages.map(stage => phaseLabel(board, stage))}
      status={statusRow}
      footer={
        <CardActions
          actions={actions}
          trailing={<WorkItemActivity activity={activity} actors={actors} board={board} />}
        />
      }
    />
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
