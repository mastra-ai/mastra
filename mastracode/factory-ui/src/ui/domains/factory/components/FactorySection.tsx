import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Brain, GitPullRequest, House, Logs, SquareKanban, Timeline } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useParams } from 'react-router';

import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { useOverlays } from '../../../lib/overlays';

/**
 * The Factory menu: Board navigation plus whatever the caller nests under it
 * (the factory Sessions list). Renders for any server-backed Factory — a
 * Factory with no linked repositories (or a disconnected GitHub integration)
 * still has a Board; those states surface connect CTAs inside the pages
 * instead of hiding the navigation.
 */
export function FactorySection({ children }: { children?: ReactNode }) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();

  if (!factoryId) return null;

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <MainSidebar.NavList>
        <FactoryLink to={`/factories/${factoryId}/overview`} icon={House} label="Overview" />
        <FactoryLink to={`/factories/${factoryId}/work`} icon={SquareKanban} label="Work" />
        <FactoryLink to={`/factories/${factoryId}/review`} icon={GitPullRequest} label="Review" />
        <FactoryLink to={`/factories/${factoryId}/activity`} icon={Timeline} label="Activity" />
        <FactoryLink to={`/factories/${factoryId}/audit`} icon={Logs} label="Audit log" />
        {features.data?.knowledge ? (
          <FactoryLink to={`/factories/${factoryId}/knowledge`} icon={Brain} label="Knowledge" />
        ) : null}
      </MainSidebar.NavList>
      {children}
    </nav>
  );
}

function FactoryLink({ to, icon: Icon, label }: { to: string; icon: ComponentType<{ size?: number }>; label: string }) {
  const overlays = useOverlays();
  const { pathname } = useLocation();
  const isActive = pathname === to || pathname.startsWith(`${to}/`);

  return (
    <MainSidebar.NavLink asChild size="default" link={{ name: label, url: to }} isActive={isActive}>
      <NavLink to={to} onClick={() => overlays.close('sidebar')}>
        <Icon />
        <MainSidebar.NavLabel>{label}</MainSidebar.NavLabel>
      </NavLink>
    </MainSidebar.NavLink>
  );
}
