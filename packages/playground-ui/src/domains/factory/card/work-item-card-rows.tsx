import type { WorkItem } from '@internal/factory-contract';
import { useBoardCatalog } from '@mastra/react/hooks/factory';
import type { ReactNode } from 'react';
import { BoardCardRows } from '../board';

import type { AuditActorProfile } from './audit';
import {
  CardActions,
  CardStatus,
  CardMetadataLabels,
  SessionBadge,
  SourceTitle,
  WorkItemSourceIcon,
} from './board-card-parts';
import type { BoardCardStatus } from './board-card-state';
import { boardLoop, boardOf } from './board-flow';
import type { BoardInfo } from './board-flow';
import { sourceMetadata } from './board-items';
import { phaseLabel } from './board-stages';
import type { CardAction } from './card-primary-action';
import { workItemMeta } from './relationships';
import { columnReviewVerdict } from './review-verdict';
import type { ReviewVerdict } from './review-verdict';
import { reasonSummary } from './rework-reason';
import type { ReworkReason } from './rework-reason';
import { WorkItemSourceStateBadge } from './source-state-badge';
import type { BoardStageId } from './stages';
import type { WorkItemActivity as WorkItemActivityData } from './work-item-activity';
import { WorkItemActivityView } from './work-item-activity-view';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';

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
  repository,
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
  repository?: string;
}) {
  const board = boardOf(useBoardCatalog(item.githubProjectId).data, item);
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
          <WorkItemSourceStateBadge item={item} />
          <CardMetadataLabels metadata={sourceMetadata(item)} className="max-w-full min-w-0" />
        </>
      }
      otherStages={otherStages.map(stage => phaseLabel(board, stage))}
      status={statusRow}
      footer={
        <CardActions
          actions={actions}
          trailing={<WorkItemActivityView activity={activity} actors={actors} board={board} />}
        />
      }
    />
  );
}

/** "Back from Review: <first line of why>", the whole reason on hover. */
export function ReworkLine({ rework }: { rework: ReworkReason }) {
  const text = `Back from ${rework.fromLabel}${rework.reason ? `: ${reasonSummary(rework.reason)}` : ''}`;
  return (
    <Txt
      as="span"
      variant="caption"
      className="max-w-full min-w-0 truncate text-badge-orange-indicator"
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
