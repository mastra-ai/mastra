import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';
import { Search } from 'lucide-react';

import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';

// Hidden in the mobile drawer — the chat header owns the trigger at that width
export function SidebarGlobalSearchButton() {
  const { openSearch } = useGlobalSearchControls();
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <SidebarNew.SearchTrigger
      id="global-search-sidebar-trigger"
      aria-label="Search and navigate"
      shortcut={shortcutLabel}
      className="ml-auto hidden md:inline-flex"
      onClick={event => openSearch(event.currentTarget)}
    >
      <Search />
    </SidebarNew.SearchTrigger>
  );
}
