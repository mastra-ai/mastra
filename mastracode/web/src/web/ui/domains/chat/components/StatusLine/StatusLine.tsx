import { useParams } from 'react-router';

import { selectedRepository, useActiveFactoryContext } from '../../../workspaces';
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
  const { threadId } = useParams<{ threadId: string }>();
  const { activeFactory } = useActiveFactoryContext();
  const { baseUrl, resourceId, projectPath } = useChatSessionContext();
  const { transcript, busy } = useChatTranscript();
  const repository = activeFactory ? selectedRepository(activeFactory) : undefined;
  const projectRepositoryId = repository?.projectRepositoryId;
  const factoryProjectId =
    activeFactory?.binding.kind === 'factory' ? activeFactory.binding.factoryProjectId : undefined;

  return (
    <div
      aria-label="Session status line"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-ui-sm text-icon3"
    >
      <ModesSelection />
      <ActiveModel />
      <OperationalMemoryStatus />
      <RuntimeActivity />
      <ConnectionActivity />
      <QueuedFollowUps />
      <GoalStatus />
      <span className="flex-1" />
      <PullRequestLinks
        baseUrl={baseUrl}
        resourceId={resourceId}
        projectPath={projectPath}
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
