import { LogoWithoutText, MainSidebar, useMainSidebar } from '@mastra/playground-ui';
import { PlusIcon, SettingsIcon, StoreIcon, SparklesIcon, PaletteIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { useAgentStudioConfig } from '../hooks/use-agent-studio-config';
import { useRecentAgents } from '../hooks/use-recent-agents';
import { useRecentSkills } from '../hooks/use-recent-skills';
import { AgentAvatar } from './agent-avatar';
import { resolveAgentAvatar } from './avatar';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { MastraVersionFooter } from '@/domains/configuration/components/mastra-version-footer';
import { useLinkComponent } from '@/lib/framework';

const isActivePath = (pathname: string, url: string): boolean => pathname === url || pathname.startsWith(url + '/');

export function AgentStudioSidebar() {
  const { Link } = useLinkComponent();
  const { state } = useMainSidebar();
  const location = useLocation();
  const pathname = location.pathname;

  const { data: authCapabilities } = useAuthCapabilities();
  const isUserAuthenticated = authCapabilities && isAuthenticated(authCapabilities);
  const { hasPermission, rbacEnabled } = usePermissions();

  const { config } = useAgentStudioConfig();
  const { recents, maxItems } = useRecentAgents();
  const { recents: recentSkills } = useRecentSkills();

  const canWriteAgents = !rbacEnabled || hasPermission('stored-agents:write');
  const canWriteSkills = !rbacEnabled || hasPermission('stored:write');
  const canRead = !rbacEnabled || hasPermission('stored-agents:read');

  const marketplaceEnabled = config?.marketplace?.enabled !== false;
  const showMarketplaceAgents = marketplaceEnabled && config?.marketplace?.showAgents !== false;
  const showMarketplaceSkills = marketplaceEnabled && config?.marketplace?.showSkills !== false;

  const allowSkillCreation = config?.configure?.allowSkillCreation !== false && canWriteSkills;
  const allowAppearance = config?.configure?.allowAppearance !== false;
  const showConfigureSection = allowSkillCreation || allowAppearance;

  return (
    <MainSidebar>
      <div className="pt-3 mb-4 -ml-0.5 sticky top-0 bg-surface1 z-10">
        {state === 'collapsed' ? (
          <div className="flex flex-col gap-3 items-center">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0 ml-3" />
            {isUserAuthenticated && <AuthStatus />}
          </div>
        ) : isUserAuthenticated ? (
          <span className="flex items-center justify-between pl-3 pr-2">
            <span className="flex items-center gap-2">
              <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
              <span className="font-serif text-sm">Mastra Studio</span>
            </span>
            <AuthStatus />
          </span>
        ) : (
          <span className="flex items-center gap-2 pl-3">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-serif text-sm">Mastra Studio</span>
          </span>
        )}
      </div>

      <MainSidebar.Nav>
        {/* Agents — recents + View all */}
        {canRead && (
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader
              LinkComponent={Link}
              state={state}
              href="/agent-studio/agents"
              isActive={pathname === '/agent-studio/agents'}
            >
              Agents
            </MainSidebar.NavHeader>
            <MainSidebar.NavList>
              {canWriteAgents && (
                <MainSidebar.NavLink
                  LinkComponent={Link}
                  state={state}
                  isActive={pathname === '/agent-studio/agents/create'}
                  link={{
                    name: 'New agent',
                    url: '/agent-studio/agents/create',
                    icon: <PlusIcon />,
                    isOnMastraPlatform: true,
                    indent: true,
                    variant: 'featured',
                  }}
                />
              )}
              {recents.slice(0, maxItems).map(agent => {
                const url = `/agent-studio/agents/${agent.id}/chat`;
                const avatarUrl = resolveAgentAvatar(agent);
                return (
                  <MainSidebar.NavLink
                    key={agent.id}
                    LinkComponent={Link}
                    state={state}
                    isActive={isActivePath(pathname, url)}
                    link={{
                      name: agent.name || agent.id,
                      url,
                      icon: <AgentAvatar name={agent.name} avatarUrl={avatarUrl} size={18} />,
                      isOnMastraPlatform: true,
                      indent: true,
                    }}
                  />
                );
              })}
              <MainSidebar.NavLink
                LinkComponent={Link}
                state={state}
                isActive={pathname === '/agent-studio/agents'}
                link={{
                  name: 'View all',
                  url: '/agent-studio/agents',
                  icon: <SparklesIcon />,
                  isOnMastraPlatform: true,
                  indent: true,
                }}
              />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        )}

        {/* Marketplace */}
        {marketplaceEnabled && canRead && (showMarketplaceAgents || showMarketplaceSkills) && (
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader
              LinkComponent={Link}
              state={state}
              href="/agent-studio/marketplace"
              isActive={pathname === '/agent-studio/marketplace'}
            >
              Marketplace
            </MainSidebar.NavHeader>
            <MainSidebar.NavList>
              {showMarketplaceAgents && (
                <MainSidebar.NavLink
                  LinkComponent={Link}
                  state={state}
                  isActive={isActivePath(pathname, '/agent-studio/marketplace/agents')}
                  link={{
                    name: 'Agents',
                    url: '/agent-studio/marketplace/agents',
                    icon: <StoreIcon />,
                    isOnMastraPlatform: true,
                    indent: true,
                  }}
                />
              )}
              {showMarketplaceSkills && (
                <>
                  <MainSidebar.NavLink
                    LinkComponent={Link}
                    state={state}
                    isActive={isActivePath(pathname, '/agent-studio/marketplace/skills')}
                    link={{
                      name: 'Skills',
                      url: '/agent-studio/marketplace/skills',
                      icon: <SparklesIcon />,
                      isOnMastraPlatform: true,
                      indent: true,
                    }}
                  />
                  {recentSkills.slice(0, maxItems).map(skill => {
                    const url = `/agent-studio/marketplace/skills/${skill.id}`;
                    return (
                      <MainSidebar.NavLink
                        key={skill.id}
                        LinkComponent={Link}
                        state={state}
                        isActive={isActivePath(pathname, url)}
                        link={{
                          name: skill.name || skill.id,
                          url,
                          icon: <SparklesIcon />,
                          isOnMastraPlatform: true,
                          indent: true,
                        }}
                      />
                    );
                  })}
                </>
              )}
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        )}

        {/* Configure */}
        {showConfigureSection && (
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader
              LinkComponent={Link}
              state={state}
              href="/agent-studio/configure"
              isActive={pathname === '/agent-studio/configure'}
            >
              Configure
            </MainSidebar.NavHeader>
            <MainSidebar.NavList>
              {allowSkillCreation && (
                <MainSidebar.NavLink
                  LinkComponent={Link}
                  state={state}
                  isActive={isActivePath(pathname, '/agent-studio/configure/skills')}
                  link={{
                    name: 'Skills',
                    url: '/agent-studio/configure/skills',
                    icon: <SparklesIcon />,
                    isOnMastraPlatform: true,
                    indent: true,
                  }}
                />
              )}
              {allowAppearance && (
                <MainSidebar.NavLink
                  LinkComponent={Link}
                  state={state}
                  isActive={pathname === '/agent-studio/configure/appearance'}
                  link={{
                    name: 'Appearance',
                    url: '/agent-studio/configure/appearance',
                    icon: <PaletteIcon />,
                    isOnMastraPlatform: true,
                    indent: true,
                  }}
                />
              )}
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        )}

        <MainSidebar.NavSection>
          <MainSidebar.NavSeparator />
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={Link}
              state={state}
              isActive={pathname === '/settings'}
              link={{
                name: 'Settings',
                url: '/settings',
                icon: <SettingsIcon />,
                isOnMastraPlatform: false,
              }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        {state !== 'collapsed' && (
          <>
            <MainSidebar.NavSeparator />
            <MastraVersionFooter collapsed={false} />
          </>
        )}
        <MainSidebar.NavSeparator />
        <div className="flex justify-end pb-3">
          <MainSidebar.Trigger />
        </div>
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
