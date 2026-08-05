import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { NavLink } from '@mastra/playground-ui/components/MainSidebar';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Blocks, LibraryIcon, ServerCogIcon, StarIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { useBuilderAgentAccess } from '@/domains/agent-builder/hooks/use-builder-agent-access';
import { useBuilderAgentFeatures } from '@/domains/agent-builder/hooks/use-builder-agent-features';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { useAuthCapabilities } from '@/domains/auth/hooks';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { useLinkComponent } from '@/lib/framework';

const agentsLink: NavLink = {
  name: 'My agents',
  url: '/agent-builder/agents',
  icon: <AgentIcon />,
};

const favoritesLink: NavLink = {
  name: 'Favorites',
  url: '/agent-builder/favorite',
  icon: <StarIcon />,
};

const libraryLink: NavLink = {
  name: 'Library',
  url: '/agent-builder/library',
  icon: <LibraryIcon />,
};

const skillsLink: NavLink = {
  name: 'Skills',
  url: '/agent-builder/skills',
  icon: <Blocks className="h-4 w-4" />,
};

const infrastructureLink: NavLink = {
  name: 'Infrastructure',
  url: '/agent-builder/infrastructure',
  icon: <ServerCogIcon className="h-4 w-4" />,
};

type AgentBuilderSidebarProps = {
  forceExpanded?: boolean;
};

export function AgentBuilderSidebar({ forceExpanded = false }: AgentBuilderSidebarProps = {}) {
  const { Link } = useLinkComponent();
  const { state: contextState, isMobile } = useMainSidebar();
  const { pathname } = useLocation();
  const features = useBuilderAgentFeatures();
  const { canManageSkills, canUseFavorites } = useBuilderAgentAccess();
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');
  const state = forceExpanded ? 'default' : contextState;
  const { data: capabilities } = useAuthCapabilities();
  const isUserAuthenticated = capabilities && isAuthenticated(capabilities);

  const links = useMemo(() => {
    const result: NavLink[] = [agentsLink];
    if (features.skills && canManageSkills) {
      result.push(skillsLink);
    }
    if (canUseFavorites) {
      result.push(favoritesLink);
    }
    result.push(libraryLink);
    return result;
  }, [features.skills, canManageSkills, canUseFavorites]);

  return (
    <MainSidebar className="h-full">
      {!forceExpanded && (
        <div className="mb-4 pt-3">
          {state === 'collapsed' ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative grid size-9 place-items-center">
                <Link
                  href="/agents"
                  aria-label="Back to Mastra Studio"
                  className={cn('transition-opacity duration-150', !isMobile && 'group-hover/sidebar:opacity-0')}
                >
                  <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
                </Link>
                {!isMobile && (
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
                    <MainSidebar.Trigger />
                  </div>
                )}
              </div>
              {isUserAuthenticated && <AuthStatus />}
            </div>
          ) : isUserAuthenticated ? (
            <span className="flex items-center justify-between pr-2 pl-3">
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <Link
                  href="/agents"
                  aria-label="Back to Mastra Studio"
                  className="flex min-w-0 items-center gap-2 rounded-sm hover:opacity-80"
                >
                  <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
                  <span className="font-display truncate text-sm whitespace-nowrap">Mastra Studio</span>
                </Link>
                {!isMobile && <MainSidebar.Trigger />}
              </span>
              <AuthStatus />
            </span>
          ) : (
            <span className="flex items-center gap-2 pr-2 pl-3">
              <Link
                href="/agents"
                aria-label="Back to Mastra Studio"
                className="flex min-w-0 items-center gap-2 rounded-sm hover:opacity-80"
              >
                <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
                <span className="font-display truncate text-sm whitespace-nowrap">Mastra Studio</span>
              </Link>
              {!isMobile && <MainSidebar.Trigger />}
            </span>
          )}
        </div>
      )}

      <ImpersonationBanner />

      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavList>
            {links.map(link => {
              const isActive = pathname.startsWith(link.url);

              return (
                <MainSidebar.NavLink
                  key={link.name}
                  LinkComponent={Link}
                  state={state}
                  link={link}
                  isActive={isActive}
                />
              );
            })}
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      {!forceExpanded && (
        <MainSidebar.Bottom>
          {canViewInfrastructure && (
            <>
              <MainSidebar.NavSeparator />
              <MainSidebar.NavSection>
                <MainSidebar.NavList>
                  <MainSidebar.NavLink
                    LinkComponent={Link}
                    state={state}
                    link={infrastructureLink}
                    isActive={pathname.startsWith(infrastructureLink.url)}
                  />
                </MainSidebar.NavList>
              </MainSidebar.NavSection>
            </>
          )}
        </MainSidebar.Bottom>
      )}
    </MainSidebar>
  );
}
