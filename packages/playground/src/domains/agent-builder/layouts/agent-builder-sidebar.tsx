import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { SidebarNew, useSidebarNew } from '@mastra/playground-ui/new/sidebar';
import type { SidebarNewLink } from '@mastra/playground-ui/new/sidebar';
import { useAuthCapabilities, isAuthenticated } from '@mastra/react/hooks';
import { Blocks, LibraryIcon, ServerCogIcon, StarIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { useBuilderAgentAccess } from '@/domains/agent-builder/hooks/use-builder-agent-access';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

const agentsLink: SidebarNewLink = {
  name: 'My agents',
  url: '/agent-builder/agents',
  icon: <AgentIcon />,
};

const favoritesLink: SidebarNewLink = {
  name: 'Favorites',
  url: '/agent-builder/favorite',
  icon: <StarIcon />,
};

const libraryLink: SidebarNewLink = {
  name: 'Library',
  url: '/agent-builder/library',
  icon: <LibraryIcon />,
};

const skillsLink: SidebarNewLink = {
  name: 'Skills',
  url: '/agent-builder/skills',
  icon: <Blocks className="h-4 w-4" />,
};

const infrastructureLink: SidebarNewLink = {
  name: 'Infrastructure',
  url: '/agent-builder/infrastructure',
  icon: <ServerCogIcon className="h-4 w-4" />,
};

type AgentBuilderSidebarProps = {
  forceExpanded?: boolean;
};

export function AgentBuilderSidebar({ forceExpanded = false }: AgentBuilderSidebarProps = {}) {
  const { Link } = useLinkComponent();
  const { state: contextState, isMobile } = useSidebarNew();
  const { pathname } = useLocation();
  const features = useBuilderAgentFeatures();
  const { canManageSkills, canUseFavorites } = useBuilderAgentAccess();
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');
  const state = forceExpanded ? 'default' : contextState;
  const { data: capabilities } = useAuthCapabilities();
  const isUserAuthenticated = capabilities && isAuthenticated(capabilities);

  const links: SidebarNewLink[] = [agentsLink];
  if (features.skills && canManageSkills) links.push(skillsLink);
  if (canUseFavorites) links.push(favoritesLink);
  links.push(libraryLink);
  const backToStudio = (
    <Link href="/agents" aria-label="Back to Mastra Studio">
      <LogoWithoutText className="size-6" />
    </Link>
  );

  return (
    <SidebarNew className="h-full" mobileMode="drawer">
      {!forceExpanded && (
        <SidebarNew.Header collapsedLogo={backToStudio} actions={isUserAuthenticated && <AuthStatus />}>
          <Link href="/agents" aria-label="Back to Mastra Studio" className="min-w-0 flex-1">
            <SidebarNew.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra Studio" />
          </Link>
          {!isMobile && <SidebarNew.Trigger />}
        </SidebarNew.Header>
      )}

      <ImpersonationBanner />

      <SidebarNew.Nav>
        <SidebarNew.NavSection>
          <SidebarNew.NavList>
            {links.map(link => {
              const isActive = pathname.startsWith(link.url);

              return (
                <SidebarNew.NavLink
                  key={link.name}
                  LinkComponent={Link}
                  state={state}
                  link={link}
                  isActive={isActive}
                />
              );
            })}
          </SidebarNew.NavList>
        </SidebarNew.NavSection>
      </SidebarNew.Nav>

      {!forceExpanded && (
        <SidebarNew.Footer>
          {canViewInfrastructure && (
            <>
              <SidebarNew.NavSeparator />
              <SidebarNew.NavSection>
                <SidebarNew.NavList>
                  <SidebarNew.NavLink
                    LinkComponent={Link}
                    state={state}
                    link={infrastructureLink}
                    isActive={pathname.startsWith(infrastructureLink.url)}
                  />
                </SidebarNew.NavList>
              </SidebarNew.NavSection>
            </>
          )}
        </SidebarNew.Footer>
      )}
    </SidebarNew>
  );
}
