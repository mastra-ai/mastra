import type { ActivityStatus } from '@mastra/playground-ui/components/Activity';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import type { BoardCardStatus } from '../boardCardState';
import { boardOf } from '../boardFlow';
import type { DragPayload } from '../boardDrag';
import { sourceCreatedAt, sourceMetadata, workItemKey } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { CardMorph } from '../hooks/useCardMorph';
import type { AuditActorProfile } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import {
  CardActions,
  CardKey,
  CardStatus,
  MetadataLabels,
  SourceTitle,
  WorkItemSourceIcon,
} from './BoardCardParts';
import { BoardListRow } from './BoardListRow';
import { WorkItemActivity } from './WorkItemActivity';
import type { ReworkReason } from '../reworkReason';
import { columnReviewVerdict, ReviewVerdictBadge, ReworkLine } from './WorkItemCardRows';

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
  rework,
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
  rework?: ReworkReason;
}) {
  const board = boardOf(useBoardCatalog(item.githubProjectId).data, item);
  const verdict = columnReviewVerdict(item, columnStage, board);
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
      createdAt={sourceCreatedAt(sourceMetadata(item)) ?? item.createdAt}
      cells={{
        icon: <WorkItemSourceIcon item={item} />,
        key: <CardKey item={item} />,
        title: (
          <Txt as="span" variant="label" tone="ink" className="truncate font-[550] tracking-tight">
            <SourceTitle source={item.source} title={item.title} />
          </Txt>
        ),
        links: relatedLinks,
        labels: (
          <span className="flex items-center gap-2">
            {item.workItem?.author && (
              <Txt as="span" variant="meta" tone="faint">
                {item.workItem.author}
              </Txt>
            )}
            {item.workItem?.provider !== 'factory' && item.workItem?.state && (
              <Badge size="xs" variant="neutral" aria-label={`Source state: ${item.workItem.state}`}>
                {item.workItem.state}
              </Badge>
            )}
            <MetadataLabels metadata={sourceMetadata(item)} />
          </span>
        ),
        status: (status.kind !== 'idle' || verdict || rework) && (
          <span className="flex min-w-0 items-center gap-2">
            <CardStatus status={status} compact />
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
