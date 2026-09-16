import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import type { RefObject } from 'react';

/**
 * `{` toggles the threads panel. Rendered inside the agent `KeyboardScope`, so
 * the binding only exists while an agent thread page is mounted. On mobile the
 * panel is a drawer and the ref is null, so the shortcut is a no-op there.
 */
export const ThreadsPanelShortcuts = ({ panel }: { panel: RefObject<CollapsiblePanelHandle | null> }) => {
  useKeydown({ '{': () => panel.current?.toggle() });

  return null;
};
