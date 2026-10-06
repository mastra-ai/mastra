import { useSidebar } from '@mastra/playground-ui/new/sidebar';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';

/**
 * `[` toggles the main sidebar. Lives inside `Layout` because it needs the
 * `SidebarProvider` context, which `GlobalShortcuts` sits outside of.
 */
export const SidebarShortcuts = () => {
  const { toggleSidebar } = useSidebar();

  useKeydown({ '[': toggleSidebar }, { repeat: false });

  return null;
};
