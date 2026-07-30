import { useFactoryQuery } from '../../../../hooks/useFactories';
import { PullRequestLinks } from '../../chat/components/PullRequestLinks';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useChatTranscript } from '../../chat/context/useChatTranscript';
import type { WorkItem } from '../services/workItems';

interface FactoryReviewPullRequestLinksProps {
  factoryId: string;
  projectRepositoryId: string | undefined;
  reviewItem: WorkItem;
  threadId: string;
}

export function FactoryReviewPullRequestLinks({
  factoryId,
  projectRepositoryId,
  reviewItem,
  threadId,
}: FactoryReviewPullRequestLinksProps) {
  const factoryQuery = useFactoryQuery(factoryId);
  const { baseUrl, resourceId, projectPath } = useChatSessionContext();
  const { transcript, busy } = useChatTranscript();
  const repository = factoryQuery.data?.repositories.find(
    candidate => candidate.projectRepositoryId === projectRepositoryId,
  );

  return (
    <PullRequestLinks
      baseUrl={baseUrl}
      resourceId={resourceId}
      projectPath={projectPath}
      projectRepositoryId={projectRepositoryId}
      reviewItem={reviewItem}
      repositorySlug={repository?.slug}
      threadId={threadId}
      transcriptEntries={transcript.entries}
      busy={busy}
      size="sm"
    />
  );
}
