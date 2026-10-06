import { Sidebar } from '@mastra/playground-ui/new/sidebar';
import { Brain, GitPullRequest, House, Logs, ShieldCheck, SquareKanban, Timeline } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useParams, useResolvedPath } from 'react-router';

import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { orderedBoards } from '../boardCatalog';
import { rememberedBoardPath } from '../services/boardViews';
import { useOverlays } from '../../../lib/overlays';

export function FactorySection({ children }: { children?: ReactNode }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();
  const catalog = useBoardCatalog(factoryId);

  if (!factoryId) return null;

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <Sidebar.NavList>
        <FactoryLink to={`/factories/${factoryId}/overview`} icon={House} label="Overview" />
        <FactoryLink to={`/factories/${factoryId}/supervisor`} icon={ShieldCheck} label="Supervisor" />
        <FactoryLink to={`/factories/${factoryId}/activity`} icon={Timeline} label="Activity" />
        <FactoryLink to={`/factories/${factoryId}/audit`} icon={Logs} label="Audit log" />
        {features.data?.knowledge ? (
          <FactoryLink to={`/factories/${factoryId}/knowledge`} icon={Brain} label="Knowledge" />
        ) : null}
      </Sidebar.NavList>
      <section className="flex flex-col gap-1" aria-label="Boards">
        <Sidebar.NavHeader icon={<SquareKanban />}>Boards</Sidebar.NavHeader>
        <Sidebar.NavList>
          {catalog.isPending ? (
            <li role="status">Loading boards…</li>
          ) : catalog.isError ? (
            <li role="alert">Unable to load boards.</li>
          ) : catalog.data.length === 0 ? (
            <li>No boards installed.</li>
          ) : (
            orderedBoards(catalog.data).map(board => (
              <FactoryLink
                key={board.id}
                to={rememberedBoardPath(factoryId, board.id)}
                icon={board.id === 'review' ? GitPullRequest : SquareKanban}
                label={board.title}
              />
            ))
          )}
        </Sidebar.NavList>
      </section>
      {children}
    </nav>
  );
}

function FactoryLink({ to, icon: Icon, label }: { to: string; icon: ComponentType<{ size?: number }>; label: string }) {
  const overlays = useOverlays();
  const { pathname } = useLocation();
  const { pathname: targetPathname } = useResolvedPath(to);
  const isActive = pathname === targetPathname || pathname.startsWith(`${targetPathname}/`);

  return (
    <Sidebar.NavLink
      link={{ name: label, url: to }}
      isActive={isActive}
      render={
        <NavLink to={to} onClick={() => overlays.close('sidebar')}>
          <Icon />
          <Sidebar.NavLabel>{label}</Sidebar.NavLabel>
        </NavLink>
      }
    />
  );
}
