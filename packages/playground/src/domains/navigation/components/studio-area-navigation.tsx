import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useLocation } from 'react-router';
import { useStudioNavigation } from '../hooks/use-studio-navigation';
import { getStudioAreaItems, studioAreas } from '../studio-areas';
import type { StudioAreaId } from '../studio-areas';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { ContextualSidebarSection } from '@/components/ui/contextual-sidebar-section';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';

/** Resource lists and actions stay in the content; this sidebar selects the task's capability. */
export function StudioAreaNavigation({ areaId }: { areaId: StudioAreaId }) {
  const { pathname } = useLocation();
  const { sections } = useStudioNavigation();
  const area = studioAreas.find(area => area.id === areaId);
  if (!area) return null;
  const items = getStudioAreaItems(
    area,
    sections.flatMap(section => section.items),
  );
  return (
    <ContextualSidebarLayout
      label={`${area.name} navigation`}
      header={
        <ContextualSidebarHeader>
          <Txt variant="subheading" className="px-3">
            {area.name}
          </Txt>
        </ContextualSidebarHeader>
      }
    >
      <ContextualSidebarSection>
        <Sidebar.Nav aria-label={`${area.name} features`}>
          <Sidebar.NavList>
            {items.map(item => (
              <Sidebar.NavLink
                key={item.url}
                state="default"
                link={{ name: item.name, url: item.url, icon: <item.Icon /> }}
                isActive={getIsLinkActive(item, pathname, items)}
              />
            ))}
          </Sidebar.NavList>
        </Sidebar.Nav>
      </ContextualSidebarSection>
    </ContextualSidebarLayout>
  );
}
