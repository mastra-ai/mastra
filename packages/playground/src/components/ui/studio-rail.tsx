import { Button } from '@mastra/playground-ui/components/Button';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router';
import { StudioRailLayout } from './studio-rail-layout';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { useStudioAreaVisibility } from '@/domains/navigation/hooks/use-studio-area-visibility';
import { useStudioDestinations } from '@/domains/navigation/hooks/use-studio-destinations';
import { STUDIO_AREA_SECTION_KEY } from '@/domains/navigation/utils/studio-area-visibility';
import { useNavigationCommand } from '@/lib/command';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';

/** Persistent desktop destinations; contextual sidebars belong to the route shells. */
export function StudioRail() {
  const { pathname } = useLocation();
  const { items, bottomItems } = useStudioDestinations();
  const visibilityStorageKey = useStudioAreaVisibility();
  const { setOpen } = useNavigationCommand({ enableShortcut: false });
  const moreLinks = items.map(item => ({
    name: item.name,
    url: item.url,
    icon: <item.Icon />,
    isActive: getIsLinkActive(item, pathname, items),
    defaultVisible: true,
  }));

  return (
    <StudioRailLayout
      header={
        <>
          <Sidebar.CommandHeader className="px-0">
            <Sidebar.Brand
              logo={<LogoWithoutText className="size-6" />}
              title="Mastra Studio"
              className="justify-center"
            />
          </Sidebar.CommandHeader>
          <div className="mb-2 flex justify-center">
            <Button
              variant="ghost"
              size="icon-md"
              tooltip="Search"
              aria-label="Search and navigate"
              className="size-10 rounded-md"
              onClick={() => setOpen(true)}
            >
              <Search />
            </Button>
          </div>
        </>
      }
      navigation={
        <Sidebar.Nav>
          <Sidebar.Sections
            sections={[{ key: STUDIO_AREA_SECTION_KEY, links: [], moreLinks }]}
            visibilityStorageKey={visibilityStorageKey}
          />
        </Sidebar.Nav>
      }
      footer={
        <Sidebar.Footer>
          <Sidebar.NavList>
            {bottomItems.map(item => (
              <Sidebar.NavLink
                key={item.url}
                state="collapsed"
                link={{ name: item.name, url: item.url, icon: <item.Icon /> }}
                isActive={getIsLinkActive(item, pathname)}
              />
            ))}
          </Sidebar.NavList>
          <div className="flex justify-center">
            <AuthStatus />
          </div>
        </Sidebar.Footer>
      }
    />
  );
}
