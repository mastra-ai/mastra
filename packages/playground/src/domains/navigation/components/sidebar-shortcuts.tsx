import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';

/**
 * `[` toggles the main sidebar. Lives inside `Layout` because it needs the
 * `MainSidebarProvider` context, which `GlobalShortcuts` sits outside of.
 */
export const SidebarShortcuts = () => {
  const { toggleSidebar } = useMainSidebar();

  useKeydown({ '[': toggleSidebar });

  return null;
};
