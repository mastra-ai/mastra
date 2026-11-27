import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { RoutingPage } from '../domains/boardCanvas/components/routing/RoutingPage';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

/** Which board takes new work: the order boards are offered a new issue or pull request, and the ones no board took. */
export function BoardIntakePage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';

  return (
    <PageLayout variant="page" body="fixed">
      <RoutingPage key={factory.id} factoryId={factory.id} boardId={boardId} repositories={factory.repositories} />
    </PageLayout>
  );
}
