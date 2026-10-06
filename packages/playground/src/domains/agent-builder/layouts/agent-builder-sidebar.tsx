import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { Sidebar, useSidebar } from '@mastra/playground-ui/new/sidebar';
import type { SidebarLink } from '@mastra/playground-ui/new/sidebar';
import { useAuthCapabilities, isAuthenticated } from '@mastra/react/hooks/auth';
import { Blocks, LibraryIcon, ServerCogIcon, StarIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { useBuilderAgentAccess } from '@/domains/agent-builder/hooks/use-builder-agent-access';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

const agentsLink: SidebarLink = {
  name: 'My agents',
  url: '/agent-builder/agents',
  icon: <AgentIcon />,
};

const favoritesLink: SidebarLink = {
  name: 'Favorites',
  url: '/agent-builder/favorite',
  icon: <StarIcon />,
};

const libraryLink: SidebarLink = {
  name: 'Library',
  url: '/agent-builder/library',
  icon: <LibraryIcon />,
};

const skillsLink: SidebarLink = {
  name: 'Skills',
  url: '/agent-builder/skills',
  icon: <Blocks className="h-4 w-4" />,
};

const infrastructureLink: SidebarLink = {
  name: 'Infrastructure',
  url: '/agent-builder/infrastructure',
  icon: <ServerCogIcon className="h-4 w-4" />,
};

type AgentBuilderSidebarProps = {
  forceExpanded?: boolean;
};

export function AgentBuilderSidebar({ forceExpanded = false }: AgentBuilderSidebarProps = {}) {
  const { Link } = useLinkComponent();
  const { state: contextState, isMobile } = useSidebar();
  const { pathname } = useLocation();
  const features = useBuilderAgentFeatures();
  const { canManageSkills, canUseFavorites } = useBuilderAgentAccess();
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');
  const state = forceExpanded ? 'default' : contextState;
  const { data: capabilities } = useAuthCapabilities();
  const isUserAuthenticated = capabilities && isAuthenticated(capabilities);

  const links: SidebarLink[] = [agentsLink];
  if (features.skills && canManageSkills) links.push(skillsLink);
  if (canUseFavorites) links.push(favoritesLink);
  links.push(libraryLink);
  const backToStudio = (
    <Link href="/agents" aria-label="Back to Mastra Studio">
      <LogoWithoutText className="size-6" />
    </Link>
  );

  return (
    <Sidebar className="h-full" mobileMode="drawer">
      {!forceExpanded && (
        <Sidebar.Header collapsedLogo={backToStudio} actions={isUserAuthenticated && <AuthStatus />}>
          <Link href="/agents" aria-label="Back to Mastra Studio" className="min-w-0 flex-1">
            <Sidebar.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra Studio" />
          </Link>
          {!isMobile && <Sidebar.Trigger />}
        </Sidebar.Header>
      )}

      <ImpersonationBanner />

      <Sidebar.Nav>
        <Sidebar.NavSection>
          <Sidebar.NavList>
            {links.map(link => {
              const isActive = pathname.startsWith(link.url);

              return (
                <Sidebar.NavLink key={link.name} LinkComponent={Link} state={state} link={link} isActive={isActive} />
              );
            })}
          </Sidebar.NavList>
        </Sidebar.NavSection>
      </Sidebar.Nav>

      {!forceExpanded && (
        <Sidebar.Footer>
          {canViewInfrastructure && (
            <>
              <Sidebar.NavSeparator />
              <Sidebar.NavSection>
                <Sidebar.NavList>
                  <Sidebar.NavLink
                    LinkComponent={Link}
                    state={state}
                    link={infrastructureLink}
                    isActive={pathname.startsWith(infrastructureLink.url)}
                  />
                </Sidebar.NavList>
              </Sidebar.NavSection>
            </>
          )}
        </Sidebar.Footer>
      )}
    </Sidebar>
  );
}
