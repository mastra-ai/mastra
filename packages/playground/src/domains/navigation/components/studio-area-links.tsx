import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { useLocation } from 'react-router';
import { useStudioNavigation } from '../hooks/use-studio-navigation';
import { getStudioAreaItems, studioAreas } from '../studio-areas';
import type { StudioAreaId } from '../studio-areas';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';

/** Area categories use the same authorization and active state in every contextual view. */
export function StudioAreaLinks({ areaId }: { areaId: StudioAreaId }) {
  const { pathname } = useLocation();
  const { sections } = useStudioNavigation();
  const area = studioAreas.find(area => area.id === areaId);
  if (!area) return null;
  const items = getStudioAreaItems(
    area,
    sections.flatMap(section => section.items),
  );

  return (
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
  );
}
