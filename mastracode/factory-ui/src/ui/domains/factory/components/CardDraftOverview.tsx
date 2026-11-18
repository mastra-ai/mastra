import type { InstalledBoardInfo } from '../../../../api/types';
import type { FactoryProject } from '../../workspaces/services/github';
import { useCardSessionRepository } from '../hooks/useCardSessionRepository';
import { linkedSessionRepository } from '../hooks/useSessionRepository';
import type { WorkItem } from '../services/workItems';
import { CardOverview } from './CardOverview';
import { CardOverviewSkeleton } from './CardOverviewSkeleton';

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
  if (lookup.isPending) return <CardOverviewSkeleton />;

  const { repository } = linkedSessionRepository(factory, lookup.data?.status === 'resolved' ? lookup.data : undefined);
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
