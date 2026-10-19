import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';

import { useGlobalSearchControls } from '../hooks/useGlobalSearchControls';

export function GlobalSearchButton({ id, className }: { id: string; className?: string }) {
  const { openSearch } = useGlobalSearchControls();
  const shortcutLabel = useKeyboardShortcutLabel('K');

  return (
    <Sidebar.SearchTrigger
      id={id}
      aria-label="Search and navigate"
      shortcut={shortcutLabel}
      className={className}
      onClick={event => openSearch(event.currentTarget)}
    />
  );
}
