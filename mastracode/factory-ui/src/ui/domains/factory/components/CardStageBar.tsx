import type { WorkItem } from '@internal/factory-contract';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { FactoryProject } from '../../workspaces/services/github';
import { useSessionSubscriptions } from '../hooks/useSessionSubscriptions';
import { CardPanelStageBar } from './CardPanelStageBar';

export function CardStageBar({
  item,
  sessionItems,
  board,
  factory,
  openContext,
}: {
  item: WorkItem;
  sessionItems: readonly WorkItem[];
  board: InstalledBoardInfo;
  factory: FactoryProject;
  openContext?: string;
}) {
  const currentUserId = useFactoryAuth().data?.user?.userId;
  const { session, links } = useSessionSubscriptions();
  return (
    <CardPanelStageBar
      item={item}
      sessionItems={sessionItems}
      board={board}
      factoryProjectId={factory.id}
      currentUserId={currentUserId}
      repository={session.repository?.slug}
      subscriptions={links.subscriptions}
      openContext={openContext}
    />
  );
}
