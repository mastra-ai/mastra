import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { FactoryBoardsNav } from '@mastra/playground-ui/domains/factory';
import type { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useParams, useResolvedPath } from 'react-router';

import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useCanEditBoards } from '../../../../hooks/useIntakeRoutes';
import { boardConfigPath, boardIntakePath, newBoardPath } from '../../boardConfig/boardConfigPaths';
import { boardPath, orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';
import { useOverlays } from '../../../lib/overlays';
import { HrefLink } from '../../../ui/HrefLink';
import { IconBrain } from '@mastra/playground-ui/icons/central/IconBrain';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';

export function FactorySection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();
  const catalog = useBoardCatalog(factoryId);
  const overlays = useOverlays();
  const { pathname } = useLocation();
  // Only organization admins may add a board; the server refuses everyone else.
  const canAddBoard = useCanEditBoards(factoryId);

  if (!factoryId) return null;
  const isActive = (href: string) => {
    const path = href.split('?')[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  };
  const boards = catalog.data ? orderedBoards(catalog.data) : [];
  // Settings open on the intake page, which covers all boards, beside the board in view or the first board from anywhere else.
  const configured =
    boards.find(board => {
      const path = boardPath(factoryId, board.id);
      return pathname === path || pathname.startsWith(`${path}/`);
    }) ?? boards[0];

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <FactoryBoardsNav
        boards={
          catalog.data
            ? boards.map(board => ({
                id: board.id,
                title: board.title,
                href: rememberedBoardPath(factoryId, board.id),
              }))
            : undefined
        }
        error={catalog.isError}
        onRetry={() => void catalog.refetch()}
        retrying={catalog.isFetching}
        isActive={isActive}
        newBoardHref={canAddBoard ? newBoardPath(factoryId) : undefined}
        onNavigate={() => overlays.close('sidebar')}
        LinkComponent={HrefLink}
        headerAction={
          configured && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Board settings"
              tooltip="Board settings"
              render={
                <NavLink to={boardIntakePath(factoryId, configured.id)} onClick={() => overlays.close('sidebar')} />
              }
            >
              <IconSettingsSliderHor aria-hidden />
            </Button>
          )
        }
        boardAction={board => (
          <Sidebar.NavAction
            aria-label={`Configure ${board.title}`}
            tooltip="Configure board"
            className="group-focus-within/nav-row:flex group-hover/nav-row:flex pointer-fine:hidden"
            render={<NavLink to={boardConfigPath(factoryId, board.id)} onClick={() => overlays.close('sidebar')} />}
          >
            <IconSettingsSliderHor aria-hidden />
          </Sidebar.NavAction>
        )}
      />
      {features.data?.knowledge ? (
        <Sidebar.NavList>
          <FactoryLink to={`/factories/${factoryId}/knowledge`} icon={IconBrain} label="Knowledge" />
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
