import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { RouterBoardSettingsHost } from './board/RouterBoardSettingsHost';
import { RoutingPage } from '../domains/boardCanvas/components/routing/RoutingPage';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

/** Which board takes new work: the order boards are offered a new issue or pull request, and the ones no board took. */
export function BoardIntakePage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';

  return (
    <PageLayout variant="page" body="fixed">
      <RouterBoardSettingsHost factoryId={factory.id}>
        <RoutingPage key={factory.id} factoryId={factory.id} boardId={boardId} repositories={factory.repositories} />
      </RouterBoardSettingsHost>
    </PageLayout>
  );
}
