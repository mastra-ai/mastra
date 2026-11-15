import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { boardOf } from '../boardFlow';
import { currentItemStage, phaseLabel } from '../boardStages';
import { CHANGE_REQUEST_STATUS_LABELS, cardChangeRequest, changeRequestStatus } from '../changeRequestState';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { relationshipLabel, relationshipPath, workItemReferenceLabel } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { WorkItemSourceIcon } from './BoardCardParts';
import { BoardStageIcon, boardPhaseIconKind, stageColorClass } from './BoardIcons';

export function RelatedCardLink({
  item,
  boards,
  factoryId,
  repository,
  liveSessions,
  subscriptions,
}: {
  item: WorkItem;
  /** Undefined when the board catalog couldn't be read: the link then names no phase rather than guess one. */
  boards: readonly InstalledBoardInfo[] | undefined;
  factoryId: string;
  repository: string | undefined;
  liveSessions: readonly string[];
  subscriptions: readonly PullRequestSubscription[];
}) {
  const session = Object.values(item.sessions)
    .filter(candidate => liveSessions.includes(candidate.sessionId))
    .at(-1);
  const to = session
    ? `/factories/${factoryId}/workspaces/${session.sessionId}/threads/${session.threadId}`
    : relationshipPath(item, factoryId);
  const board = boardOf(boards, item);
  const stage = boards === undefined ? undefined : currentItemStage(item, board);
  const kind = stage === undefined ? undefined : boardPhaseIconKind(board, stage);
  const phase = stage === undefined ? undefined : phaseLabel(board, stage);
  const request = cardChangeRequest(item);
  const status = request && changeRequestStatus(request, subscriptions);
  const statusLabel = request && status && CHANGE_REQUEST_STATUS_LABELS[request.provider][status];
  const name = [`Open ${relationshipLabel(item, repository)}: ${item.title}`, phase, statusLabel]
    .filter(Boolean)
    .join(', ');
  return (
    <Button variant="ghost" size="sm" className="w-full justify-start" aria-label={name} render={<Link to={to} />}>
      <WorkItemSourceIcon item={item} subscriptions={subscriptions} />
      <Txt as="span" variant="caption" tone="muted" className="shrink-0">
        {workItemReferenceLabel(item, repository)}
      </Txt>
      <span className="min-w-0 truncate">{item.title}</span>
      {stage === undefined ? null : (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <span
            className={cn('flex [--control-icon:currentColor] [&>:first-child]:size-3.5', stageColorClass(stage, kind))}
          >
            <BoardStageIcon stage={stage} kind={kind} decorative />
          </span>
          <Txt as="span" variant="caption" tone="muted">
            {phase}
          </Txt>
        </span>
      )}
    </Button>
  );
}
