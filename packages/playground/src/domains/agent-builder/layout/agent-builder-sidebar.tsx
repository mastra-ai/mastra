import { AgentIcon, LogoWithoutText, MainSidebar, useMainSidebar } from '@mastra/playground-ui';
import type { NavLink } from '@mastra/playground-ui';
import { BookIcon, FolderIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { useLinkComponent } from '@/lib/framework';

const links: NavLink[] = [
  { name: 'Projects', url: '#', icon: <FolderIcon />, isOnMastraPlatform: true },
  { name: 'Agents', url: '#', icon: <AgentIcon />, isOnMastraPlatform: true },
  { name: 'Library', url: '#', icon: <BookIcon />, isOnMastraPlatform: true },
];

export function AgentBuilderSidebar() {
  const { Link } = useLinkComponent();
  const { state } = useMainSidebar();
  const { pathname } = useLocation();

  return (
    <MainSidebar>
      <div className="pt-3 mb-4 -ml-0.5 sticky top-0 bg-surface1 z-10">
        {state === 'collapsed' ? (
          <div className="flex flex-col gap-3 items-center">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0 ml-3" />
          </div>
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
            {links.map(link => (
              <MainSidebar.NavLink
                key={link.name}
                LinkComponent={Link}
                state={state}
                link={link}
                isActive={pathname === link.url}
              />
            ))}
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        <MainSidebar.NavSeparator />
        <div className="flex justify-end pb-3">
          <MainSidebar.Trigger />
        </div>
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
