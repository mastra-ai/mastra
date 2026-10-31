import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../../hooks/useFactories';
import { useThreadWorkItem } from '../../../../../hooks/useThreadWorkItem';
import { isPullRequestSource } from '../../../factory/services/workItems';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { PullRequestLinks } from '../PullRequestLinks';
import { ModelPicker } from './ModelPicker';
import { ConnectionActivity } from './ConnectionActivity';
import { GoalStatus } from './GoalStatus';
import { OperationalMemoryStatus } from './OperationalMemoryStatus';
import { ModelCredential } from './ModelCredential';
import { QueuedFollowUps } from './QueuedFollowUps';
import { RuntimeActivity } from './RuntimeActivity';

/**
 * Session status strip below the composer. Pure composition root: each child
 * reads its own slice of the existing chat/session context.
 */
export function StatusLine() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId: string }>();
  const { factorySessionState } = useChatSessionContext();
  const { data: factory } = useFactoryQuery(factoryId);
  const repository = factory?.repositories.find(
    repo => repo.projectRepositoryId === factorySessionState?.projectRepositoryId,
  );
  const factoryProjectId = factorySessionState?.factoryProjectId;
  const factoryProjectKey = typeof factoryProjectId === 'string' ? factoryProjectId : undefined;
  const workItem = useThreadWorkItem(factoryProjectKey, threadId);
  const currentItem = workItem.data;
  const workItemsPending = Boolean(factoryProjectKey) && workItem.isPending;

  return (
    <div
      aria-label="Session status line"
      className="text-caption text-muted-foreground flex h-fit shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1"
    >
      <ModelPicker />
      <ModelCredential />
      <OperationalMemoryStatus />
      <RuntimeActivity />
      <ConnectionActivity />
      <QueuedFollowUps />
      <GoalStatus />
      {!workItemsPending && (!currentItem || !isPullRequestSource(currentItem.source)) ? (
        <PullRequestLinks repository={repository} threadId={threadId} />
      ) : null}
    </div>
  );
}
