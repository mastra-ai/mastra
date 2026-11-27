import { cardChangeRequest } from '@mastra/factory/work-items/change-requests';
import { RelatedCardLink as SharedRelatedCardLink } from '@mastra/playground-ui/domains/factory';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { InstalledBoardInfo } from '../../../../api/types';
import { HrefLink } from '../../../ui/HrefLink';
import { boardOf } from '../boardFlow';
import { currentItemStage, phaseLabel } from '../boardStages';
import { changeRequestStatus, changeRequestStatusLabel } from '../changeRequestState';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { relatedCardName, relationshipPath, workItemReference } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { WorkItemSourceIcon } from './BoardCardParts';
import { BoardStageIcon, boardPhaseIconKind, stageColorClass } from './BoardIcons';
import { threadPath } from '../../workspaces/services/factoryPaths';

export function RelatedCardLink({
  item,
  boards,
  factoryId,
  repository,
  liveSessions,
  subscriptions,
}: {
  item: WorkItem;
  boards: readonly InstalledBoardInfo[] | undefined;
  factoryId: string;
  repository: string | undefined;
  liveSessions: readonly string[];
  subscriptions: readonly PullRequestSubscription[];
}) {
  const session = Object.values(item.sessions)
    .filter(candidate => liveSessions.includes(candidate.sessionId))
    .at(-1);
  const to = session ? threadPath(factoryId, session) : relationshipPath(item, factoryId);
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
      LinkComponent={HrefLink}
    />
  );
}
