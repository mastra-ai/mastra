import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link, useLocation } from 'react-router';

import { useBoardQuery } from '../../hooks/useBoardEditor';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { boardConfigPath } from '../domains/boardConfig/boardConfigPaths';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { CardMovesMap } from '../domains/routeMaps/moves/CardMovesMap';
import { RouteViewTabs, useRouteView } from '../domains/routeMaps/RouteViewTabs';
import { CardMovesSection } from '../domains/settings/components/IntakeRoutesSection';
import { intakeRouteAnchor } from '../domains/settings/settingsSections';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';

const COLUMN = 'mx-auto w-full max-w-2xl';
// The map needs the room the editor's reading width would squeeze out of it.
const WIDE_COLUMN = 'mx-auto w-full max-w-5xl';

/** How cards already on a board move when their issue or pull request changes, opened from board settings. */
export function CardMovesPage() {
  const factory = useActiveFactory();
  const boardId = useBoardConfigRoute()?.boardId ?? '';
  const { isMobile, desktopState } = useSidebar();
  const sidebarHidden = isMobile || desktopState === 'collapsed';
  const board = useBoardQuery(factory.id, boardId).data?.board;
  const { pathname } = useLocation();
  const [view] = useRouteView();
  const column = view === 'map' ? WIDE_COLUMN : COLUMN;

  const slots = useSidebarHeaderSlots({
    breadcrumbs:
      sidebarHidden && board ? (
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <Crumb as={Link} to={boardConfigPath(factory.id, boardId)}>
            {board.name}
          </Crumb>
          <Crumb as="span" isCurrent>
            Card moves
          </Crumb>
        </Breadcrumb>
      ) : undefined,
  });

  return (
    <PageLayout
      variant="narrow"
      header={
        <div className={cn(column, 'pb-8')}>
          <PageHeader>
            <PageHeader.Title>Card moves</PageHeader.Title>
            <PageHeader.Description>
              Where cards on this board go when their issue or pull request changes. The first matching move wins.
            </PageHeader.Description>
          </PageHeader>
        </div>
      }
      {...slots}
    >
      <div className={column}>
        <RouteViewTabs
          label="Card moves view"
          editor={<CardMovesSection factoryId={factory.id} boardId={boardId} />}
          map={
            <CardMovesMap
              factoryId={factory.id}
              boardId={boardId}
              moveHref={routeId => `${pathname}#${intakeRouteAnchor(routeId)}`}
            />
          }
        />
      </div>
    </PageLayout>
  );
}
