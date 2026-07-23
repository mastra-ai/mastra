import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChartLine, GitPullRequest, ListChecks, ScrollText, SquareKanban } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useParams } from 'react-router';

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

  if (!factoryId) return null;

  return (
    <nav className="flex flex-col gap-2" aria-label="Factory">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          Factory
        </Txt>
      </div>
      <MainSidebar.NavList>
        <FactoryLink to={`/factories/${factoryId}/work`} icon={SquareKanban} label="Work" />
        <FactoryLink to={`/factories/${factoryId}/review`} icon={GitPullRequest} label="Review" />
        <FactoryLink to={`/factories/${factoryId}/metrics`} icon={ChartLine} label="Metrics" />
        <FactoryLink to={`/factories/${factoryId}/rules`} icon={ListChecks} label="Rules" />
        <FactoryLink to={`/factories/${factoryId}/audit`} icon={ScrollText} label="Audit log" />
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
