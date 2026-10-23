import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useThreadsPanel } from '../context/use-threads-panel';

/**
 * `{` toggles the threads panel. Rendered inside the agent `KeyboardScope`, so
 * the binding only exists while an agent thread page is mounted. On mobile the
 * panel is a drawer and never registers, so the shortcut is a no-op there.
 */
export const ThreadsPanelShortcuts = () => {
  const threadsPanel = useThreadsPanel();
  useKeydown({ '{': () => threadsPanel?.toggle() });

  return null;
};
