import type { SessionRowStatus } from '@mastra/factory/session/session-row-status';
import { cardThreadSession, itemThreadSession } from '@mastra/factory/work-items/card-context-sessions';
import { ActivityWick } from '@mastra/playground-ui/components/Activity';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { BOARD_CARD_LAYOUT_CLASS } from '../boardLayout';
import type { ReactElement } from 'react';

import { Link, useParams } from 'react-router';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { cardPath, threadPath } from '../../workspaces/services/factoryPaths';
import type { BoardCardOwner } from '../boardCardState';
import { setDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import { reworkReason } from '../reworkReason';
import type { BoardLayout } from '../boardLayout';
import { itemBoard } from '../boardStages';
import { cardControls } from '../cardControls';
import { useBoardRepository } from '../hooks/useBoardRepository';
import type { AuditEventPage } from '../services/audit';
import type { FactoryDecisionSummary } from '../services/decisions';
import { relationshipPath } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { workItemActivity } from '../workItemActivity';
import { REVEAL_ON_CARD_HOVER } from './BoardCardParts';
import { RelatedWorkItemLink } from './RelatedWorkItemLink';
import { WorkItemCardRows } from './WorkItemCardRows';
import { WorkItemListRow } from './WorkItemListRow';
import type { WorkItemMenuProps } from './WorkItemMenuItems';
import { WorkItemMenuItems } from './WorkItemMenuItems';
import { WorkItemUpstreamLinks } from './WorkItemUpstreamLinks';
import { IconDotGrid1x3Vertical } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Vertical';

export function WorkItemCard({
  item,
  deepLinkRef,
  highlighted,
  columnStage,
  relatedItems,
  activityPage,
  evaluatingStage,
  transitionReason,
  decision,
  proposal,
  approvingDecisionId,
  retryingDecisionId,
  queuePosition,
  onApproveProposal,
  onDismissProposal,
  onRetryDecision,
  sessionStatus,
  sessionHolds,
  ownerCurrent = true,
  onMove,
  onMoveToBoard,
  onRemove,
  layout,
}: {
  item: WorkItem;
  // Hands the card's own control to the board, which scrolls to it and focuses it when the card is deeplinked.
  deepLinkRef: (element: HTMLElement | null) => void;
  highlighted: boolean;
  columnStage: BoardStageId;
  /** Cards linked to this one, resolved once for the whole board. */
  relatedItems: WorkItem[];
  activityPage?: AuditEventPage;
  /** Destination stage of an in-flight transition; undefined = not moving. */
  evaluatingStage?: string;
  transitionReason?: string;
  decision?: FactoryDecisionSummary;
  /** The decision's place in the run queue while it waits for a run slot. */
  queuePosition?: number;
  /** Run a rule wants to start on this card, waiting for someone to release it. */
  proposal?: FactoryDecisionSummary;
  approvingDecisionId?: string;
  retryingDecisionId?: string;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onRetryDecision: (decisionId: string) => void;
  /** The card's marker, resolved once for the whole board: the status its row in the sidebar shows. */
  sessionStatus?: SessionRowStatus;
  /** One of the card's sessions is coming up, running, or parked on a person. */
  sessionHolds?: boolean;
  /**
   * Whether the board read everything that says who holds the card. When it has not, the card
   * refuses no move up front and the server, which holds the rule too, decides. A suggested run
   * skips that rule on the server, so the card holds it back instead.
   */
  ownerCurrent?: boolean;
  onMove: (toStage: string) => void;
  onMoveToBoard: (toBoard: string, toStage: string) => void;
  onRemove: () => void;
  layout: BoardLayout;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const catalog = useBoardCatalog(item.githubProjectId);
  const repository = useBoardRepository(item.githubProjectId);
  const boardId = itemBoard(item);
  const definition = catalog.data?.find(board => board.id === boardId);
  const {
    moves,
    proposedRunLabel,
    state,
    actions: offered,
  } = cardControls({
    item,
    definition,
    columnStage,
    evaluatingStage,
    transitionReason,
    decision,
    queuePosition,
    proposal,
    approvingDecisionId,
    retryingDecisionId,
    sessionStatus,
    sessionHolds,
    onApproveProposal,
    onRetryDecision,
    onMove,
  });
  const href = cardPath(factoryId, item.id, cardThreadSession(item, definition?.phases, columnStage));
  const rework = definition ? reworkReason(item, definition.phases, activityPage?.events) : undefined;
  const activity = workItemActivity(item, activityPage);
  const { status, owner, wick } = state;
  const hasSession = Object.keys(item.sessions).length > 0;
  const lockedByYou = owner.kind === 'you';
  const busy = lockedByYou || owner.kind === 'automation';
  // Your own move in flight is known here for certain; anyone else's hold only once the board read it.
  const movesOwner: BoardCardOwner = ownerCurrent || lockedByYou ? owner : { kind: 'free' };
  const actions =
    ownerCurrent || status.kind !== 'waiting' ? offered : offered.map(action => ({ ...action, disabled: true }));
  const dragPayload: DragPayload | undefined = lockedByYou
    ? undefined
    : { kind: 'work-item', id: item.id, fromStage: columnStage, ownerKind: movesOwner.kind };

  const menu: WorkItemMenuProps = {
    item,
    columnStage,
    moves,
    proposal,
    proposedRunLabel,
    approvingDecisionId,
    owner: movesOwner,
    ownerCurrent,
    onApproveProposal,
    onDismissProposal,
    onMove,
    onMoveToBoard,
    onRemove,
  };

  const relatedLink = (related: WorkItem): ReactElement => {
    const relatedSession = itemThreadSession(related.sessions);
    const link = { item: related, contextRepository: repository };

    if (relatedSession !== undefined) {
      return (
        <RelatedWorkItemLink key={related.id} {...link} href={threadPath(factoryId, relatedSession)} kind="session" />
      );
    }

    if (related.url !== null) {
      return <RelatedWorkItemLink key={related.id} {...link} href={related.url} kind="external" />;
    }

    return <RelatedWorkItemLink key={related.id} {...link} href={relationshipPath(related, factoryId)} kind="board" />;
  };
  const relatedLinks = relatedItems.map(relatedLink);
  const upstreamLinks = (
    <WorkItemUpstreamLinks
      item={item}
      shownAsRelated={relatedItems.flatMap(related => related.url ?? [])}
      short={layout === 'list'}
    />
  );

  if (layout === 'list') {
    return (
      <WorkItemListRow
        item={item}
        href={href}
        columnStage={columnStage}
        deepLinkRef={deepLinkRef}
        highlighted={highlighted}
        activityStatus={wick}
        hasSession={hasSession}
        relatedLinks={relatedLinks}
        upstreamLinks={upstreamLinks}
        locked={lockedByYou}
        busy={busy}
        dragPayload={dragPayload}
        activity={activity}
        actors={activityPage?.actors ?? {}}
        status={status}
        actions={actions}
        menu={<WorkItemMenuItems {...menu} />}
        rework={rework}
      />
    );
  }

  return (
    <article
      draggable={dragPayload !== undefined}
      aria-label={item.title}
      aria-busy={busy || undefined}
      data-testid="work-item-card"
      data-related={relatedItems.length > 0 ? 'true' : undefined}
      data-highlighted={highlighted || undefined}
      onDragStart={event => {
        if (dragPayload) setDragPayload(event, dragPayload);
      }}
      className={cn(
        BOARD_CARD_LAYOUT_CLASS,
        'group outline-none transition-colors hover:bg-fill-hover',
        // `content-visibility` clips at the padding box, which the wick's ring has to reach past.
        wick ? 'border-transparent' : '[content-visibility:auto] [contain-intrinsic-size:auto_9rem]',
        lockedByYou ? 'cursor-wait opacity-70' : 'cursor-grab active:cursor-grabbing',
        highlighted && 'border-warning-edge bg-warning-subtle ring-1 ring-warning-edge',
      )}
    >
      {wick && <ActivityWick status={wick} />}
      <Link
        ref={deepLinkRef}
        to={href}
        draggable={false}
        aria-label={`Open ${item.title}`}
        className={`rounded-card absolute inset-0 cursor-pointer ${focusRingInset}`}
      />
      <WorkItemCardRows
        item={item}
        columnStage={columnStage}
        relatedLinks={relatedLinks}
        upstreamLinks={upstreamLinks}
        activity={activity}
        actors={activityPage?.actors ?? {}}
        status={status}
        actions={actions}
        hasSession={hasSession}
        rework={rework}
        controls={
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={lockedByYou}
                  aria-label={`Actions for ${item.title}`}
                  className={REVEAL_ON_CARD_HOVER}
                >
                  <IconDotGrid1x3Vertical aria-hidden />
                </Button>
              }
            />
            <DropdownMenu.Content align="end" className="min-w-44">
              <WorkItemMenuItems {...menu} />
            </DropdownMenu.Content>
          </DropdownMenu>
        }
      />
    </article>
  );
}
