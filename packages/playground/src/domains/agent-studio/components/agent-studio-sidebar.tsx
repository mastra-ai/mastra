import { LogoWithoutText, MainSidebar, useMainSidebar } from '@mastra/playground-ui';
import { SettingsIcon, StoreIcon, UsersIcon, BotIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { useShouldShowAgentStudio } from '../hooks/use-should-show-agent-studio';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
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
  const { isAdmin } = useShouldShowAgentStudio();

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
        <MainSidebar.NavSection>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={Link}
              state={state}
              isActive={isActivePath(pathname, '/agent-studio/agents')}
              link={{
                name: 'Agents',
                url: '/agent-studio/agents',
                icon: <BotIcon />,
                isOnMastraPlatform: true,
              }}
            />
            <MainSidebar.NavLink
              LinkComponent={Link}
              state={state}
              isActive={isActivePath(pathname, '/agent-studio/projects')}
              link={{
                name: 'Projects',
                url: '/agent-studio/projects',
                icon: <UsersIcon />,
                isOnMastraPlatform: true,
              }}
            />
            <MainSidebar.NavLink
              LinkComponent={Link}
              state={state}
              isActive={isActivePath(pathname, '/agent-studio/library')}
              link={{
                name: 'Library',
                url: '/agent-studio/library',
                icon: <StoreIcon />,
                isOnMastraPlatform: true,
              }}
            />
            <MainSidebar.NavLink
              LinkComponent={Link}
              state={state}
              isActive={isActivePath(pathname, '/agent-studio/configure')}
              link={{
                name: 'Configure',
                url: '/agent-studio/configure',
                icon: <SettingsIcon />,
                isOnMastraPlatform: true,
              }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        {isAdmin && state !== 'collapsed' && (
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
