import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';

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
      <IconMagnifyingGlass />
    </Sidebar.SearchTrigger>
  );
}
