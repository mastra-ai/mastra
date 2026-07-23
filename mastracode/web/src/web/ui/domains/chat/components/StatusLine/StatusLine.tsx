import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../../../shared/hooks/useFactories';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { useChatTranscript } from '../../context/useChatTranscript';
import { ActiveModel } from './ActiveModel';
import { ConnectionActivity } from './ConnectionActivity';
import { GoalStatus } from './GoalStatus';
import { ModesSelection } from './ModesSelection';
import { OperationalMemoryStatus } from './OperationalMemoryStatus';
import { PullRequestLinks } from './PullRequestLinks';
import { QueuedFollowUps } from './QueuedFollowUps';
import { RuntimeActivity } from './RuntimeActivity';

/**
 * Session status strip below the composer. Pure composition root: each child
 * reads its own slice of the existing chat/session context.
 */
export function StatusLine() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId: string }>();
  const { baseUrl, resourceId, factorySessionState } = useChatSessionContext();
  const { data: factory } = useFactoryQuery(factoryId);
  const { transcript, busy } = useChatTranscript();
  const repository = factory?.repositories.find(
    repo => repo.projectRepositoryId === factorySessionState?.projectRepositoryId,
  );
  const projectRepositoryId = repository?.projectRepositoryId;
  const factoryProjectId = factorySessionState?.factoryProjectId;

  return (
    <div
      aria-label="Session status line"
      className="flex h-fit shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-ui-sm text-icon3"
    >
      <ModesSelection />
      <ActiveModel />
      <OperationalMemoryStatus />
      <RuntimeActivity />
      <ConnectionActivity />
      <QueuedFollowUps />
      <GoalStatus />
      <PullRequestLinks
        baseUrl={baseUrl}
        resourceId={resourceId}
        projectRepositoryId={projectRepositoryId}
        factoryProjectId={factoryProjectId}
        repositorySlug={repository?.slug}
        threadId={threadId}
        transcriptEntries={transcript.entries}
        busy={busy}
      />
    </div>
  );
}
