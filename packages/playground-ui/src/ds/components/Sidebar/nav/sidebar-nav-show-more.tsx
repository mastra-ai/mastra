import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../../../lib/utils';
import { textStyle } from '../../../primitives/text';
import { controlStateColorTransition, focusRing } from '../../../primitives/transitions';
import type { SidebarState } from '../root/sidebar-context';
import { useMaybeSidebarState } from '../root/sidebar-context';

export type SidebarNavShowMoreProps = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onClick'> & {
  foldedCount: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  state?: SidebarState;
};

export function SidebarNavShowMore({
  foldedCount,
  expanded,
  onExpandedChange,
  state: stateProp,
  className,
  ...props
}: SidebarNavShowMoreProps) {
  const context = useMaybeSidebarState();
  const state = stateProp ?? context?.state ?? 'default';
  if (state === 'collapsed' || foldedCount <= 0) return null;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => onExpandedChange(!expanded)}
      className={cn(
        textStyle({ variant: 'caption', tone: 'muted' }),
        'self-start rounded-md pl-3 text-left hover:text-foreground',
        controlStateColorTransition,
        focusRing,
        className,
      )}
      {...props}
    >
      {expanded ? 'Show less' : `Show ${foldedCount} more`}
    </button>
  );
}
