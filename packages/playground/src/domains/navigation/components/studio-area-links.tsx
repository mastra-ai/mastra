import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useStudioNavigation } from '../hooks/use-studio-navigation';
import { getStudioAreaItems, studioAreas } from '../studio-areas';
import type { StudioAreaId } from '../studio-areas';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';

/** Area categories use the same authorization and active state in every contextual view; a collection listed below them, or a capability with its own entry point, needs no row. */
export function StudioAreaLinks({
  areaId,
  omitUrls = [],
  trailingByUrl = {},
}: {
  areaId: StudioAreaId;
  omitUrls?: (string | undefined)[];
  trailingByUrl?: Record<string, ReactNode>;
}) {
  const { pathname } = useLocation();
  const { sections } = useStudioNavigation();
  const area = studioAreas.find(area => area.id === areaId);
  if (!area) return null;
  const items = getStudioAreaItems(
    area,
    sections.flatMap(section => section.items),
  ).filter(item => !omitUrls.includes(item.url));
  if (items.length === 0) return null;

  return (
    <Sidebar.Nav aria-label={`${area.name} features`}>
      <Sidebar.NavList>
        {items.map(item => (
          <Sidebar.NavLink
            key={item.url}
            state="default"
            link={{ name: item.name, url: item.url, icon: <item.Icon /> }}
            isActive={getIsLinkActive(item, pathname, items)}
          >
            {trailingByUrl[item.url]}
          </Sidebar.NavLink>
        ))}
      </Sidebar.NavList>
    </Sidebar.Nav>
  );
}

/** A custom entry point for an area capability shows only where its row would. */
export function StudioAreaLinkGate({ url, children }: { url: string; children: ReactNode }) {
  const { sections } = useStudioNavigation();
  const isAccessible = sections.some(section => section.items.some(item => item.url === url));
  return isAccessible ? children : null;
}
