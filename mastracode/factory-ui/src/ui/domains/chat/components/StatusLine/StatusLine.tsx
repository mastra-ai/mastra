import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../../hooks/useFactories';
import { useWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { PullRequestLinks } from '../PullRequestLinks';
import { ActiveModel } from './ActiveModel';
import { ConnectionActivity } from './ConnectionActivity';
import { GoalStatus } from './GoalStatus';
import { ModesSelection } from './ModesSelection';
import { OperationalMemoryStatus } from './OperationalMemoryStatus';
import { QueuedFollowUps } from './QueuedFollowUps';
import { RuntimeActivity } from './RuntimeActivity';

/**
 * Session status strip below the composer. Pure composition root: each child
 * reads its own slice of the existing chat/session context.
 */
export function StatusLine() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId: string }>();
  const { projectPath, factorySessionState } = useChatSessionContext();
  const { data: factory } = useFactoryQuery(factoryId);
  const repository = factory?.repositories.find(
    repo => repo.projectRepositoryId === factorySessionState?.projectRepositoryId,
  );
  const factoryProjectId = factorySessionState?.factoryProjectId;
  const factoryProjectKey = typeof factoryProjectId === 'string' ? factoryProjectId : undefined;
  const workItems = useWorkItemsQuery(factoryProjectKey);
  const currentItem = workItems.data?.find(item =>
    Object.values(item.sessions).some(
      session => session.threadId === threadId && (!projectPath || session.sessionId === projectPath),
    ),
  );
  const workItemsPending = Boolean(factoryProjectKey) && workItems.isPending;

  return (
    <div
      aria-label="Session status line"
      className="text-ui-sm text-icon3 flex h-fit shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1"
    >
      <ModesSelection />
      <ActiveModel />
      <OperationalMemoryStatus />
      <RuntimeActivity />
      <ConnectionActivity />
      <QueuedFollowUps />
      <GoalStatus />
      {!workItemsPending && currentItem?.source !== 'github-pr' ? (
        <PullRequestLinks repository={repository} threadId={threadId} />
      ) : null}
    </div>
  );
}
