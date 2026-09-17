import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import type { ReactNode, Ref } from 'react';

import { cn } from '@/lib/utils';

export interface DataPanelContentProps {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Layout overrides (e.g. padding) for the scroll container. */
  className?: string;
}

// `DrawerPrimitive.Content` marks the region as swipe-exempt so scrolling or
// selecting text inside the panel body doesn't start a swipe-to-dismiss.
export function DataPanelContent({ children, ref, className }: DataPanelContentProps) {
  return (
    <DrawerPrimitive.Content ref={ref} className={cn('min-h-0 flex-1 overflow-y-auto p-3', className)}>
      {children}
    </DrawerPrimitive.Content>
  );
}
