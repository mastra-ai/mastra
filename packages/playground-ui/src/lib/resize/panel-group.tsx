import { useEffect, useRef } from 'react';
import type { GroupProps } from 'react-resizable-panels';
import { Group } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export type PanelGroupProps = Omit<GroupProps, 'elementRef'>;

/**
 * A resizable panel group with smooth programmatic resizing. CSS keeps pointer
 * dragging immediate and disables motion when the user prefers reduced motion.
 */
export function PanelGroup({ className, ...props }: PanelGroupProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Let the panel library commit its initial or restored layout before
    // programmatic resize motion is armed.
    element.dataset.panelResizeReady = '';
    return () => {
      delete element.dataset.panelResizeReady;
    };
  }, []);

  return <Group elementRef={elementRef} className={cn('panel-group-resize-transition', className)} {...props} />;
}
