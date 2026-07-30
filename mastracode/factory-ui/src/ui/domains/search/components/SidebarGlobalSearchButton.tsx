import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Search } from 'lucide-react';

import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';

export function SidebarGlobalSearchButton() {
  const { openSearch } = useGlobalSearchControls();
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <MainSidebar.NavList className="mb-2 hidden md:grid">
      <MainSidebar.NavLink asChild size="default" link={{ name: 'Search and navigate', url: '#', icon: <Search /> }}>
        <button
          id="global-search-sidebar-trigger"
          type="button"
          aria-label="Search and navigate"
          onClick={event => openSearch(event.currentTarget)}
        >
          <Search />
          <MainSidebar.NavLabel>Search and navigate</MainSidebar.NavLabel>
          <Kbd className="ml-auto">{shortcutLabel}</Kbd>
        </button>
      </MainSidebar.NavLink>
    </MainSidebar.NavList>
  );
}
