import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import type { ReactNode, Ref } from 'react';

import { useDataPanelVariant } from './data-panel-context';
import { cn } from '@/lib/utils';

export interface DataPanelContentProps {
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
  /** Layout overrides (e.g. padding) for the scroll container. */
  className?: string;
}

const CONTENT_CLASSES = 'min-h-0 flex-1 overflow-y-auto px-2 py-3';

// In the drawer variant, `DrawerPrimitive.Content` marks the region as swipe-exempt
// so scrolling or selecting text inside the panel body doesn't start a
// swipe-to-dismiss. The inline variant has no drawer, so a plain div is enough.
export function DataPanelContent({ children, ref, className }: DataPanelContentProps) {
  const variant = useDataPanelVariant();

  if (variant === 'inline') {
    return (
      <div ref={ref} className={cn(CONTENT_CLASSES, className)}>
        {children}
      </div>
    );
  }

  return (
    <DrawerPrimitive.Content ref={ref} className={cn(CONTENT_CLASSES, className)}>
      {children}
    </DrawerPrimitive.Content>
  );
}
