import type { ActivityStatus } from '@mastra/playground-ui/components/Activity';
import { ListRowLabels, ListRowLinks, ListRowStatus, ListRowTitle } from '@mastra/playground-ui/domains/factory';
import type { ReactNode } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import type { BoardCardStatus } from '../boardCardState';
import { boardOf } from '../boardFlow';
import type { DragPayload } from '../boardDrag';
import { sourceCreatedAt, sourceMetadata } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { AuditActorProfile } from '../services/audit';
import { workItemShortReference } from '../services/relationships';
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
import { BoardListRow } from './BoardListRow';
import { SourceStateBadge } from './SourceStateBadge';
import { WorkItemActivity } from './WorkItemActivity';
import type { ReworkReason } from '../reworkReason';
import { columnReviewVerdict, ReviewVerdictBadge, ReworkLine } from './WorkItemCardRows';

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
    <BoardListRow
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
            <SourceStateBadge item={item} />
            <MetadataLabels metadata={sourceMetadata(item)} />
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
        activity: <WorkItemActivity activity={activity} actors={actors} board={board} showName={false} />,
      }}
    />
  );
}
