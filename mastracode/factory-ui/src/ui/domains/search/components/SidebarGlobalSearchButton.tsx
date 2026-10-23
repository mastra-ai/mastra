import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Search } from 'lucide-react';

import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';

export function SidebarGlobalSearchButton() {
  const { openSearch } = useGlobalSearchControls();
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <Sidebar.SearchTrigger
      aria-label="Search and navigate"
      shortcut={shortcutLabel}
      className="hidden md:inline-flex"
      onClick={event => openSearch(event.currentTarget)}
    >
      <Search />
    </Sidebar.SearchTrigger>
  );
}
