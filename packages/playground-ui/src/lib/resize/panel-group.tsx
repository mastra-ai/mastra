import type { GroupProps } from 'react-resizable-panels';
import { Group } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import './panel-group.css';

export type PanelGroupProps = GroupProps;

/**
 * A resizable panel group with smooth programmatic resizing. CSS keeps pointer
 * dragging immediate and disables motion when the user prefers reduced motion.
 */
export function PanelGroup({ className, ...props }: PanelGroupProps) {
  return <Group className={cn('panel-group-resize-transition', className)} {...props} />;
}
