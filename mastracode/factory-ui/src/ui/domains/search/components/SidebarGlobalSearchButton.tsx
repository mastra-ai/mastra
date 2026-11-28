import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { useGlobalSearchControls } from '@mastra/playground-ui/domains/factory/session/thread/search/hooks/useGlobalSearchControls';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';

export function SidebarGlobalSearchButton() {
  const { openSearch } = useGlobalSearchControls();
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <Sidebar.SearchTrigger
      aria-label="Search and navigate"
      shortcut={shortcutLabel}
      onClick={event => openSearch(event.currentTarget)}
    >
      <IconMagnifyingGlass />
    </Sidebar.SearchTrigger>
  );
}
