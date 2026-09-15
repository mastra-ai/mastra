import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Search } from 'lucide-react';

import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';

// Hidden in the mobile drawer — the chat header owns the trigger at that width
export function SidebarGlobalSearchButton() {
  const { openSearch } = useGlobalSearchControls();
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <Button
      id="global-search-sidebar-trigger"
      type="button"
      variant="ghost"
      className="ml-auto hidden md:inline-flex"
      aria-label="Search and navigate"
      onClick={event => openSearch(event.currentTarget)}
    >
      <Search />
      <Kbd size="xs">{shortcutLabel}</Kbd>
    </Button>
  );
}
