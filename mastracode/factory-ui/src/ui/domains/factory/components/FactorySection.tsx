import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Brain, Plus, Settings2, SquareKanban } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useParams, useResolvedPath } from 'react-router';

import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useCanEditBoards } from '../../../../hooks/useIntakeRoutes';
import { boardConfigPath, newBoardPath } from '../../boardConfig/boardConfigPaths';
import { boardPath, orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';
import { useOverlays } from '../../../lib/overlays';
import { SidebarEmptyNote, SidebarLoadError } from '../../../ui/LoadErrorState';
import { SidebarNavigationSkeleton } from '../../../ui/SidebarNavigationSkeleton';

export function FactorySection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();
  const catalog = useBoardCatalog(factoryId);
  const overlays = useOverlays();
  const { pathname } = useLocation();
  // Only organization admins may add a board; the server refuses everyone else.
  const canAddBoard = useCanEditBoards(factoryId);

  if (!factoryId) return null;
  const boards = catalog.data ? orderedBoards(catalog.data) : [];
  // Settings open on the board in view, or the first board from anywhere else.
  const configured =
    boards.find(board => {
      const path = boardPath(factoryId, board.id);
      return pathname === path || pathname.startsWith(`${path}/`);
    }) ?? boards[0];

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <section className="flex flex-col gap-1" aria-label="Boards">
        <Sidebar.NavHeader
          className="mt-0"
          action={
            configured && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Board settings"
                tooltip="Board settings"
                render={
                  <NavLink to={boardConfigPath(factoryId, configured.id)} onClick={() => overlays.close('sidebar')} />
                }
              >
                <Settings2 aria-hidden />
              </Button>
            )
          }
        >
          Boards
        </Sidebar.NavHeader>
        <Sidebar.NavList>
          {catalog.isPending ? (
            <li>
              <SidebarNavigationSkeleton label="Loading boards" rows={2} />
            </li>
          ) : catalog.isError ? (
            <li>
              <SidebarLoadError onRetry={() => void catalog.refetch()} retrying={catalog.isFetching}>
                Couldn’t load boards
              </SidebarLoadError>
            </li>
          ) : catalog.data.length === 0 ? (
            <li>
              <SidebarEmptyNote>No boards installed.</SidebarEmptyNote>
            </li>
          ) : (
            boards.map(board => (
              <FactoryLink
                key={board.id}
                to={rememberedBoardPath(factoryId, board.id)}
                icon={SquareKanban}
                label={board.title}
                action={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Configure ${board.title}`}
                    tooltip="Configure board"
                    className="group-focus-within/board:flex group-hover/board:flex pointer-fine:hidden"
                    render={
                      <NavLink to={boardConfigPath(factoryId, board.id)} onClick={() => overlays.close('sidebar')} />
                    }
                  >
                    <Settings2 aria-hidden />
                  </Button>
                }
              />
            ))
          )}
          {canAddBoard && <FactoryLink to={newBoardPath(factoryId)} icon={Plus} label="New board" />}
        </Sidebar.NavList>
      </section>
      {features.data?.knowledge ? (
        <Sidebar.NavList>
          <FactoryLink to={`/factories/${factoryId}/knowledge`} icon={Brain} label="Knowledge" />
        </Sidebar.NavList>
      ) : null}
    </nav>
  );
}

function FactoryLink({
  to,
  icon: Icon,
  label,
  action,
}: {
  to: string;
  icon: ComponentType<{ size?: number }>;
  label: string;
  /** Revealed on hover or focus, beside the link rather than inside it. */
  action?: ReactNode;
}) {
  const overlays = useOverlays();
  const { pathname } = useLocation();
  const { pathname: targetPathname } = useResolvedPath(to);
  const isActive = pathname === targetPathname || pathname.startsWith(`${targetPathname}/`);

  return (
    <Sidebar.NavLink
      link={{ name: label, url: to }}
      isActive={isActive}
      className={action ? 'group/board' : undefined}
      action={action}
      render={
        <NavLink to={to} onClick={() => overlays.close('sidebar')}>
          <Icon />
          <Sidebar.NavLabel>{label}</Sidebar.NavLabel>
        </NavLink>
      }
    />
  );
}
