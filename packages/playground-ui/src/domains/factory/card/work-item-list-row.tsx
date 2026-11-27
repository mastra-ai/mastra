import type { WorkItem } from '@mastra/client-js';
import { useBoardCatalog } from '@mastra/react/hooks/factory';
import type { ReactNode } from 'react';
import { ListRowLabels, ListRowLinks, ListRowStatus, ListRowTitle } from '../board';

import type { DragPayload } from '../board/board-drag';
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
import { boardOf } from './board-flow';
import { sourceCreatedAt, sourceMetadata } from './board-items';
import { WorkItemBoardListRow } from './board-list-row';
import type { CardAction } from './card-primary-action';
import { workItemShortReference } from './relationships';
import { columnReviewVerdict } from './review-verdict';
import type { ReworkReason } from './rework-reason';
import { WorkItemSourceStateBadge } from './source-state-badge';
import type { BoardStageId } from './stages';
import type { WorkItemActivity as WorkItemActivityData } from './work-item-activity';
import { WorkItemActivityView } from './work-item-activity-view';
import { ReviewVerdictBadge, ReworkLine } from './work-item-card-rows';
import type { ActivityStatus } from '@/ds/components/Activity';

export function WorkItemListRow({
  item,
  href,
  columnStage,
  deepLinkRef,
  highlighted,
  activityStatus,
  hasSession,
  relatedLinks,
  upstreamLinks,
  locked,
  busy,
  dragPayload,
  activity,
  actors,
  status,
  actions,
  menu,
  rework,
}: {
  item: WorkItem;
  href: string;
  columnStage: BoardStageId;
  deepLinkRef: (element: HTMLElement | null) => void;
  highlighted: boolean;
  activityStatus?: ActivityStatus;
  hasSession: boolean;
  relatedLinks: ReactNode;
  upstreamLinks: ReactNode;
  locked: boolean;
  busy: boolean;
  dragPayload: DragPayload | undefined;
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  status: BoardCardStatus;
  actions: CardAction[];
  menu: ReactNode;
  rework?: ReworkReason;
}) {
  const board = boardOf(useBoardCatalog(item.githubProjectId).data, item);
  const verdict = columnReviewVerdict(item, columnStage, board);
  // Native cards have no upstream link to carry their key, so the row shows it as text.
  const nativeKey = item.url === null ? workItemShortReference(item) : undefined;
  return (
    <WorkItemBoardListRow
      title={item.title}
      href={href}
      linkRef={deepLinkRef}
      dragPayload={dragPayload}
      locked={locked}
      busy={busy}
      highlighted={highlighted}
      activityStatus={activityStatus}
      menu={menu}
      createdAt={sourceCreatedAt(sourceMetadata(item)) ?? item.createdAt}
      cells={{
        icon: <WorkItemSourceIcon item={item} />,
        title: (
          <ListRowTitle>
            <SourceTitle source={item.source} title={item.title} />
          </ListRowTitle>
        ),
        links: (
          <ListRowLinks nativeKey={nativeKey}>
            {upstreamLinks}
            {relatedLinks}
          </ListRowLinks>
        ),
        labels: (
          <ListRowLabels author={item.workItem?.author}>
            <WorkItemSourceStateBadge item={item} />
            <CardMetadataLabels metadata={sourceMetadata(item)} />
          </ListRowLabels>
        ),
        status: (status.kind !== 'idle' || hasSession || verdict || rework) && (
          <ListRowStatus>
            <CardStatus status={status} compact />
            {hasSession && <SessionBadge />}
            {verdict && <ReviewVerdictBadge verdict={verdict} />}
            {rework && <ReworkLine rework={rework} />}
          </ListRowStatus>
        ),
        action: <CardActions actions={actions} />,
        activity: <WorkItemActivityView activity={activity} actors={actors} board={board} showName={false} />,
      }}
    />
  );
}
