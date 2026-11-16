import type { DrawerProps } from '@mastra/playground-ui/components/Drawer';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';

export function useSidePanelDrawer(): Required<Pick<DrawerProps, 'side' | 'variant' | 'overlay'>> {
  const isMobile = useIsMobile();
  return { side: isMobile ? 'bottom' : 'right', variant: isMobile ? 'default' : 'floating', overlay: 'visible' };
}
