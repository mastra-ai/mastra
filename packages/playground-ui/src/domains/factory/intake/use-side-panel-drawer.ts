import type { DrawerProps } from '@/ds/components/Drawer';
import { useIsMobile } from '@/hooks/use-is-mobile';

export function useSidePanelDrawer(): Required<Pick<DrawerProps, 'side' | 'variant' | 'overlay'>> {
  const isMobile = useIsMobile();
  return { side: isMobile ? 'bottom' : 'right', variant: isMobile ? 'default' : 'floating', overlay: 'visible' };
}
