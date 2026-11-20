import type { ActivityStatus } from '@mastra/playground-ui/components/Activity';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import type { BoardCardStatus } from '../boardCardState';
import { boardOf } from '../boardFlow';
import type { DragPayload } from '../boardDrag';
import { sourceCreatedAt, sourceMetadata } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { AuditActorProfile } from '../services/audit';
import { workItemShortReference } from '../services/relationships';
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
          <Txt as="span" variant="label" tone="ink" className="truncate font-[550] tracking-tight">
            <SourceTitle source={item.source} title={item.title} />
          </Txt>
        ),
        links: (
          <>
            {nativeKey !== undefined && (
              <Txt as="span" variant="meta" tone="faint" className="truncate">
                {nativeKey}
              </Txt>
            )}
            {upstreamLinks}
            {relatedLinks}
          </>
        ),
        labels: (
          <span className="flex items-center gap-2">
            {item.workItem?.author && (
              <Txt as="span" variant="meta" tone="faint">
                {item.workItem.author}
              </Txt>
            )}
            <SourceStateBadge item={item} />
            <MetadataLabels metadata={sourceMetadata(item)} />
          </span>
        ),
        status: (status.kind !== 'idle' || hasSession || verdict || rework) && (
          <span className="flex min-w-0 items-center gap-2">
            <CardStatus status={status} compact />
            {hasSession && <SessionBadge />}
            {verdict && <ReviewVerdictBadge verdict={verdict} />}
            {rework && <ReworkLine rework={rework} />}
          </span>
        ),
        action: <CardActions actions={actions} />,
        activity: <WorkItemActivity activity={activity} actors={actors} board={board} showName={false} />,
      }}
    />
  );
}
