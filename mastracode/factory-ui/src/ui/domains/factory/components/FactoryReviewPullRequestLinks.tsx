import { useFactoryQuery } from '../../../../hooks/useFactories';
import { PullRequestLinks } from '../../chat/components/PullRequestLinks';
import type { WorkItem } from '../services/workItems';

interface FactoryReviewPullRequestLinksProps {
  factoryId: string;
  projectRepositoryId: string | undefined;
  reviewItem: WorkItem;
  threadId: string;
}

// only renders inside the thread's chat providers — PullRequestLinks reads session + transcript context
export function FactoryReviewPullRequestLinks({
  factoryId,
  projectRepositoryId,
  reviewItem,
  threadId,
}: FactoryReviewPullRequestLinksProps) {
  const factoryQuery = useFactoryQuery(factoryId);
  const repository = factoryQuery.data?.repositories.find(
    candidate => candidate.projectRepositoryId === projectRepositoryId,
  );

  return <PullRequestLinks repository={repository} reviewItem={reviewItem} threadId={threadId} size="sm" />;
}
