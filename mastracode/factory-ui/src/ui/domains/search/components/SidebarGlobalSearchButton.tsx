import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import type { MouseEvent } from 'react';
import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';

export function SidebarGlobalSearchButton() {
  const { openSearch } = useGlobalSearchControls();

  return <SidebarGlobalSearchTrigger onClick={event => openSearch(event.currentTarget)} />;
}

export function SidebarGlobalSearchTrigger({ onClick }: { onClick?: (event: MouseEvent<HTMLButtonElement>) => void }) {
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <Sidebar.SearchTrigger aria-label="Search and navigate" shortcut={shortcutLabel} onClick={onClick}>
      <IconMagnifyingGlass />
    </Sidebar.SearchTrigger>
  );
}
