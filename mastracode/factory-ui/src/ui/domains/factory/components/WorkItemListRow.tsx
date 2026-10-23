import type { ActivityStatus } from '@mastra/playground-ui/components/Activity';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { BoardCardStatus } from '../boardCardState';
import type { DragPayload } from '../boardDrag';
import { sourceCreatedAt, workItemKey } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { CardMorph } from '../hooks/useCardMorph';
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
import { BoardListRow } from './BoardListRow';
import { WorkItemActivity } from './WorkItemActivity';
import { columnReviewVerdict, ReviewVerdictBadge } from './WorkItemCardRows';

export function WorkItemListRow({
  item,
  columnStage,
  morph,
  deepLinkRef,
  highlighted,
  activityStatus,
  relatedLinks,
  locked,
  busy,
  dragPayload,
  activity,
  actors,
  status,
  actions,
  menu,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  morph: CardMorph;
  deepLinkRef: (element: HTMLElement | null) => void;
  highlighted: boolean;
  activityStatus?: ActivityStatus;
  relatedLinks: ReactNode;
  locked: boolean;
  busy: boolean;
  dragPayload: DragPayload | undefined;
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  status: BoardCardStatus;
  actions: CardAction[];
  menu: ReactNode;
}) {
  const verdict = columnReviewVerdict(item, columnStage);
  return (
    <BoardListRow
      testId="work-item-card"
      title={item.title}
      cardRef={morph.setCardElement}
      detailsRef={deepLinkRef}
      expanded={morph.open}
      onToggleDetails={morph.toggleDetails}
      dragPayload={dragPayload}
      locked={locked}
      busy={busy}
      highlighted={highlighted}
      activityStatus={activityStatus}
      menu={menu}
      createdAt={sourceCreatedAt(item.metadata) ?? item.createdAt}
      cells={{
        icon: <WorkItemSourceIcon item={item} />,
        key: workItemKey(item),
        title: (
          <Txt as="span" variant="label" tone="ink" className="truncate font-[550] tracking-tight">
            <SourceTitle source={item.source} title={item.title} />
          </Txt>
        ),
        links: relatedLinks,
        labels: (
          <span className="flex items-center gap-2">
            <CommentCount count={item.commentCount} />
            <MetadataLabels metadata={item.metadata} />
          </span>
        ),
        status: (status.kind !== 'idle' || verdict) && (
          <span className="flex min-w-0 items-center gap-2">
            <CardStatus status={status} compact />
            {verdict && <ReviewVerdictBadge verdict={verdict} />}
          </span>
        ),
        action: <CardActions actions={actions} />,
        activity: <WorkItemActivity activity={activity} actors={actors} showName={false} />,
      }}
    />
  );
}
