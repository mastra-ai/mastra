import type { InstalledBoardInfo } from '../../../../api/types';
import type { FactoryProject } from '../../workspaces/services/github';
import { useCardSessionRepository } from '../hooks/useCardSessionRepository';
import { linkedSessionRepository } from '../hooks/useSessionRepository';
import type { WorkItem } from '@internal/factory-contract';
import { CardPanelOverview, CardPanelOverviewSkeleton } from '@mastra/playground-ui/domains/factory';

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
  if (lookup.isPending) return <CardPanelOverviewSkeleton />;

  const { repository } = linkedSessionRepository(factory, lookup.data?.status === 'resolved' ? lookup.data : undefined);
  return (
    <CardPanelOverview
      item={item}
      sessionItems={[item]}
      boards={boards}
      boardsFailed={boardsFailed}
      repository={repository}
      repositoryFailed={lookup.isError}
      subscriptions={[]}
      pullRequestsFailed={false}
    />
  );
}
