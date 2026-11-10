import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Brain, Plus, SquareKanban } from 'lucide-react';
import type { ComponentType } from 'react';
import { NavLink, useLocation, useParams, useResolvedPath } from 'react-router';
import type { Location } from 'react-router';

import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useCanEditBoards } from '../../../../hooks/useBoardEditor';
import { boardSettingsPath } from '../../settings/services/boardDraft';
import { orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';
import { useOverlays } from '../../../lib/overlays';
import { SidebarNavigationSkeleton } from '../../../ui/SidebarNavigationSkeleton';

export function FactorySection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();
  const catalog = useBoardCatalog(factoryId);
  // Only organization admins may add a board; the server refuses everyone else.
  const canAddBoard = useCanEditBoards(factoryId);
  const location = useLocation();

  if (!factoryId) return null;

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <section className="flex flex-col gap-1" aria-label="Boards">
        <Sidebar.NavHeader className="mt-0">Boards</Sidebar.NavHeader>
        <Sidebar.NavList>
          {catalog.isPending ? (
            <li>
              <SidebarNavigationSkeleton label="Loading boards" rows={2} />
            </li>
          ) : catalog.isError ? (
            <li role="alert">Unable to load boards.</li>
          ) : catalog.data.length === 0 ? (
            <li>No boards installed.</li>
          ) : (
            orderedBoards(catalog.data).map(board => (
              <FactoryLink
                key={board.id}
                to={rememberedBoardPath(factoryId, board.id)}
                icon={SquareKanban}
                label={board.title}
              />
            ))
          )}
          {canAddBoard && (
            <FactoryLink
              to={boardSettingsPath(factoryId, { new: true })}
              state={{ from: location }}
              icon={Plus}
              label="New board"
            />
          )}
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
  state,
  icon: Icon,
  label,
}: {
  to: string;
  /** Where closing Settings returns to, for a link that opens it. */
  state?: { from: Location };
  icon: ComponentType<{ size?: number }>;
  label: string;
}) {
  const overlays = useOverlays();
  const { pathname } = useLocation();
  const { pathname: targetPathname } = useResolvedPath(to);
  const isActive = pathname === targetPathname || pathname.startsWith(`${targetPathname}/`);

  return (
    <Sidebar.NavLink
      link={{ name: label, url: to }}
      isActive={isActive}
      render={
        <NavLink to={to} state={state} onClick={() => overlays.close('sidebar')}>
          <Icon />
          <Sidebar.NavLabel>{label}</Sidebar.NavLabel>
        </NavLink>
      }
    />
  );
}
