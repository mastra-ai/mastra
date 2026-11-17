import type { InstalledBoardInfo } from '../../../../api/types';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { FactoryProject } from '../../workspaces/services/github';
import { useCardSessionRepository } from '../hooks/useCardSessionRepository';
import type { WorkItem } from '../services/workItems';
import { CardOverview } from './CardOverview';

export function CardDraftOverview({
  factory,
  item,
  boards,
  boardsFailed,
}: {
  factory: FactoryProject;
  item: WorkItem;
  boards: readonly InstalledBoardInfo[] | undefined;
  boardsFailed: boolean;
}) {
  const lookup = useCardSessionRepository(factory.id, item);
  if (lookup.isPending) return <SkeletonRows label="Loading overview" rows={4} className="p-3" />;

  const resolved = lookup.data?.status === 'resolved' ? lookup.data : undefined;
  const repository =
    resolved && factory.repositories.find(linked => linked.projectRepositoryId === resolved.projectRepositoryId);
  return (
    <CardOverview
      item={item}
      sessionItems={[item]}
      factoryId={factory.id}
      boards={boards}
      boardsFailed={boardsFailed}
      repository={repository}
      repositoryFailed={lookup.isError}
      subscriptions={[]}
      pullRequestsFailed={false}
    />
  );
}
