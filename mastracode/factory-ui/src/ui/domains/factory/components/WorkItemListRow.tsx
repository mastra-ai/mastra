import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { BoardCardStatus } from '../boardCardState';
import type { DragPayload } from '../boardDrag';
import { sourceCreatedAt, workItemKey } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { CardMorph } from '../hooks/useCardMorph';
import type { AuditActorProfile } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import { CardActions, CardStatus, MetadataLabels, SourceTitle, WorkItemSourceIcon } from './BoardCardParts';
import { BoardListRow } from './BoardListRow';
import { WorkItemActivity } from './WorkItemActivity';

export function WorkItemListRow({
  item,
  morph,
  deepLinkRef,
  highlighted,
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
  morph: CardMorph;
  deepLinkRef: (element: HTMLElement | null) => void;
  highlighted: boolean;
  locked: boolean;
  busy: boolean;
  dragPayload: DragPayload | undefined;
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  status: BoardCardStatus;
  actions: CardAction[];
  menu: ReactNode;
}) {
  return (
    <BoardListRow
      testId="work-item-card"
      title={item.title}
      cardRef={morph.setCardElement}
      detailsRef={deepLinkRef}
      expanded={morph.open}
      onOpen={morph.openDetails}
      dragPayload={dragPayload}
      locked={locked}
      busy={busy}
      highlighted={highlighted}
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
        labels: <MetadataLabels metadata={item.metadata} />,
        status: <CardStatus status={status} />,
        action: <CardActions actions={actions} />,
        activity: <WorkItemActivity activity={activity} actors={actors} showName={false} />,
      }}
    />
  );
}
