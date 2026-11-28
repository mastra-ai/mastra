import { cardChangeRequest } from '@internal/factory-contract';
import type { WorkItem } from '@internal/factory-contract';
import type { InstalledBoardInfo } from '@mastra/client-js';

import {
  RelatedCardLink as SharedRelatedCardLink,
  boardOf,
  currentItemStage,
  phaseLabel,
  changeRequestStatus,
  changeRequestStatusLabel,
  relatedCardName,
  workItemReference,
  WorkItemSourceIcon,
  BoardStageIcon,
  boardPhaseIconKind,
  stageColorClass,
} from '..';
import type { PullRequestSubscription } from '..';
import { useCardPanelHost } from './card-panel-host';
import { cn } from '@/utils/cn';

export function CardPanelRelatedCardLink({
  item,
  boards,
  repository,
  liveSessions,
  subscriptions,
}: {
  item: WorkItem;
  boards: readonly InstalledBoardInfo[] | undefined;
  repository: string | undefined;
  liveSessions: readonly string[];
  subscriptions: readonly PullRequestSubscription[];
}) {
  const session = Object.values(item.sessions)
    .filter(candidate => liveSessions.includes(candidate.sessionId))
    .at(-1);
  const host = useCardPanelHost();
  const to = host.relatedCardHref(item, session);
  const board = boardOf(boards, item);
  const stage = boards === undefined ? undefined : currentItemStage(item, board);
  const kind = stage === undefined ? undefined : boardPhaseIconKind(board, stage);
  const phase = stage === undefined ? undefined : phaseLabel(board, stage);
  const request = cardChangeRequest(item);
  const status = request && changeRequestStatus(request, subscriptions);
  const statusLabel = request && status && changeRequestStatusLabel(request.provider, status);
  return (
    <SharedRelatedCardLink
      href={to}
      icon={<WorkItemSourceIcon item={item} subscriptions={subscriptions} />}
      ariaLabel={[`Open ${relatedCardName(item, repository)}`, phase, statusLabel].filter(Boolean).join(', ')}
      reference={workItemReference(item, repository)}
      title={item.title}
      phase={
        stage === undefined || phase === undefined
          ? undefined
          : {
              icon: (
                <span
                  className={cn(
                    'flex [--control-icon:currentColor] [&>:first-child]:size-3.5',
                    stageColorClass(stage, kind),
                  )}
                >
                  <BoardStageIcon stage={stage} kind={kind} decorative />
                </span>
              ),
              label: phase,
            }
      }
      LinkComponent={host.LinkComponent}
    />
  );
}
