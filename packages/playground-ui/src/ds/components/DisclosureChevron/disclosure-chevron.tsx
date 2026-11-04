import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import type { ComponentProps } from 'react';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type DisclosureChevronDirection = 'down' | 'up' | 'right';

const icons = { down: ChevronDown, up: ChevronUp, right: ChevronRight } as const;

// Tailwind needs static class names, so map instead of interpolating.
const expandedRotation = {
  down: 'in-aria-expanded:rotate-180',
  up: 'in-aria-expanded:rotate-180',
  right: 'in-aria-expanded:rotate-90',
} as const;

const openRotation = { down: 'rotate-180', up: 'rotate-180', right: 'rotate-90' } as const;

export interface DisclosureChevronProps extends Omit<ComponentProps<'svg'>, 'ref'> {
  /** Where the chevron points while closed (default: down). Down and up flip 180°, right turns 90°. */
  direction?: DisclosureChevronDirection;
  /**
   * Overrides the trigger's state. Leave unset: the chevron follows the nearest
   * `aria-expanded="true"` ancestor, which every Base UI trigger sets.
   */
  open?: boolean;
}

/** The chevron in an expandable trigger (menu, select, collapsible, "show more") that turns while it is open. */
export function DisclosureChevron({ direction = 'down', open, className, ...props }: DisclosureChevronProps) {
  const Icon = icons[direction];

  return (
    <Icon
      aria-hidden
      data-slot="disclosure-chevron"
      className={cn(
        'shrink-0',
        transitions.transform,
        'motion-reduce:transition-none',
        open === undefined ? expandedRotation[direction] : open && openRotation[direction],
        className,
      )}
      {...props}
    />
  );
}
