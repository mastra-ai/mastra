import { ComposerStatus } from '@mastra/playground-ui/components/Composer';
import type { ReactNode } from 'react';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../../hooks/useFactories';
import { useSessionWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { isPullRequestSource } from '../../../factory/services/workItems';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { PullRequestLinks } from '../PullRequestLinks';
import { ConnectionActivity } from './ConnectionActivity';
import { GoalStatus } from './GoalStatus';
import { OperationalMemoryStatus } from './OperationalMemoryStatus';
import { QueuedFollowUps } from './QueuedFollowUps';
import { RuntimeActivity } from './RuntimeActivity';

/**
 * Session status row above the composer, right-aligned and hidden when empty. Pure
 * composition root: each child reads its own slice of the existing chat/session context.
 * The model picker lives in the composer actions instead.
 */
export function StatusLine({ children }: { children?: ReactNode }) {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const { factorySessionState } = useChatSessionContext();
  const { data: factory } = useFactoryQuery(factoryId);
  const repository = factory?.repositories.find(
    repo => repo.projectRepositoryId === factorySessionState?.projectRepositoryId,
  );
  const factoryProjectId = factorySessionState?.factoryProjectId;
  const factoryProjectKey = typeof factoryProjectId === 'string' ? factoryProjectId : undefined;
  const workItems = useSessionWorkItemsQuery(factoryProjectKey, sessionId);
  const currentItem = workItems.data?.find(item =>
    Object.values(item.sessions).some(session => session.threadId === threadId),
  );

  return (
    <ComposerStatus aria-label="Session status line">
      {children}
      <OperationalMemoryStatus />
      <RuntimeActivity />
      <ConnectionActivity />
      <QueuedFollowUps />
      <GoalStatus />
      {!workItems.isLoading && (!currentItem || !isPullRequestSource(currentItem.source)) ? (
        <PullRequestLinks repository={repository} threadId={threadId} />
      ) : null}
    </ComposerStatus>
  );
}
