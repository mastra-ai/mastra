import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import type { SidebarLink } from '@mastra/playground-ui/components/Sidebar';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { useAuthCapabilities, isAuthenticated } from '@mastra/react/hooks/auth';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { MastraVersionFooter } from '@/domains/configuration/components/mastra-version-footer';
import { useStudioAreaVisibility } from '@/domains/navigation/hooks/use-studio-area-visibility';
import { useStudioDestinations } from '@/domains/navigation/hooks/use-studio-destinations';
import { STUDIO_AREA_SECTION_KEY } from '@/domains/navigation/utils/studio-area-visibility';
import { useNavigationCommand } from '@/lib/command';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';
import type { NavItem } from '@/lib/nav/nav-items';

declare global {
  interface Window {
    MASTRA_HIDE_CLOUD_CTA: string;
    MASTRA_TEMPLATES?: string;
  }
}

function toSidebarLink(item: NavItem): SidebarLink {
  const { Icon } = item;
  return { name: item.name, url: item.url, icon: <Icon /> };
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { setOpen: setNavigationCommandOpen } = useNavigationCommand({ enableShortcut: false });
  const commandShortcutLabel = useKeyboardShortcutLabel('K');

  const location = useLocation();
  const pathname = location.pathname;

  const { data: authCapabilities } = useAuthCapabilities();

  const isUserAuthenticated = authCapabilities && isAuthenticated(authCapabilities);

  const openNavigationCommand = () => {
    if (isMobile) setOpenMobile(false);
    setNavigationCommandOpen(true);
  };

  const { items, bottomItems: filteredBottom } = useStudioDestinations();
  const visibilityStorageKey = useStudioAreaVisibility();
  const sections = [
    {
      key: STUDIO_AREA_SECTION_KEY,
      links: [],
      moreLinks: items.map(item => ({
        ...toSidebarLink(item),
        isActive: getIsLinkActive(item, pathname, items),
        defaultVisible: true,
      })),
    },
  ];

  return (
    <Sidebar aria-label="Sidebar">
      <Sidebar.CommandHeader>
        <Sidebar.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra Studio" />
        {isUserAuthenticated && <AuthStatus />}
        {!isMobile && (
          <Sidebar.SearchTrigger
            aria-label="Search and navigate"
            shortcut={commandShortcutLabel}
            onClick={openNavigationCommand}
          >
            <Search />
          </Sidebar.SearchTrigger>
        )}
      </Sidebar.CommandHeader>

      <Sidebar.Nav>
        <Sidebar.Sections sections={sections} visibilityStorageKey={visibilityStorageKey} />
      </Sidebar.Nav>

      <Sidebar.Footer>
        {filteredBottom.length > 0 && (
          <Sidebar.NavList>
            {filteredBottom.map(item => (
              <Sidebar.NavLink
                key={item.name}
                state={state}
                link={toSidebarLink(item)}
                isActive={getIsLinkActive(item, pathname)}
              />
            ))}
          </Sidebar.NavList>
        )}
        <MastraVersionFooter collapsed={state === 'collapsed'} />
        <Sidebar.FooterMeta action={<Sidebar.Trigger />} />
      </Sidebar.Footer>
    </Sidebar>
  );
}
