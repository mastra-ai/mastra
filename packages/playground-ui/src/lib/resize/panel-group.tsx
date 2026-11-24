import { useState } from 'react';
import type { GroupProps, Layout } from 'react-resizable-panels';
import { Group } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import './panel-group.css';

export type PanelGroupProps = GroupProps;

/**
 * A resizable panel group with smooth programmatic resizing. CSS keeps pointer
 * dragging immediate and disables motion when the user prefers reduced motion.
 * The transition is enabled only after the first layout so panels don't animate
 * from their pre-measurement size on mount.
 */
export function PanelGroup({ className, onLayoutChange, ...props }: PanelGroupProps) {
  const [hasLayout, setHasLayout] = useState(false);

  return (
    <Group
      className={cn(hasLayout && 'panel-group-resize-transition', className)}
      onLayoutChange={(layout: Layout) => {
        onLayoutChange?.(layout);
        if (!hasLayout) requestAnimationFrame(() => setHasLayout(true));
      }}
      {...props}
    />
  );
}
