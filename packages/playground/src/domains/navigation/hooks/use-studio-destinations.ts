import { useMatch } from 'react-router';
import { getStudioAreaItems, studioAreas } from '../studio-areas';
import { useStudioNavigation } from './use-studio-navigation';
import type { NavItem } from '@/lib/nav/nav-items';

/** Desktop and mobile share task destinations, including permission-aware landing pages. */
export function useStudioDestinations() {
  const chat = useMatch('/agents/:agentId/threads/*');
  const { sections, bottomItems } = useStudioNavigation();
  const authorizedItems = sections.flatMap(section => section.items);
  const items: NavItem[] = studioAreas.flatMap(area => {
    const members = getStudioAreaItems(area, authorizedItems);
    const first = members[0];
    if (!first) return [];
    return [
      {
        name: area.name,
        url: first.url,
        Icon: area.Icon,
        activePaths: [
          ...members.flatMap(item => [item.url, ...(item.activePaths ?? [])]),
          ...(area.id === 'chat' && chat ? [chat.pathnameBase] : []),
        ],
      },
    ];
  });
  return { items, bottomItems };
}
