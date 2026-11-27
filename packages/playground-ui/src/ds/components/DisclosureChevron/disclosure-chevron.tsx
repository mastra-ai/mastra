import type { ComponentProps } from 'react';
import { createCentralIcon } from '@/ds/icons/central/create-central-icon';
import { IconChevronRightMedium } from '@/ds/icons/central/IconChevronRightMedium';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';
import './disclosure-chevron.css';

export type DisclosureChevronDirection = 'down' | 'up' | 'right';

// Not `@property`: WebKit ends its running transitions when a stylesheet is added before the one declaring it,
// which Base UI does when the first menu opens. Registering twice throws (HMR, a second copy of this package).
if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
  try {
    CSS.registerProperty({ name: '--disclosure-chevron-bend', syntax: '<number>', inherits: true, initialValue: '1' });
  } catch {
    // Already registered.
  }
}

const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const arm = <path className="disclosure-chevron-arm" d="M12 12h9" {...stroke} />;

/** Central's down chevron, owned here so it can bend into the up one. */
const BendingChevron = createCentralIcon('DisclosureChevron', () => (
  <>
    <path className="disclosure-chevron-rest" d="M6 9.5L12 15.5L18 9.5" {...stroke} />
    <g className="disclosure-chevron-arms">
      {arm}
      <g transform="matrix(-1 0 0 1 24 0)">{arm}</g>
    </g>
  </>
));

// Tailwind needs static class names, so map instead of interpolating.
const bendTransition = 'transition-[--disclosure-chevron-bend] duration-normal ease-out-custom';

const base = {
  down: `${bendTransition} [--disclosure-chevron-bend:1]`,
  up: `${bendTransition} [--disclosure-chevron-bend:-1]`,
  right: transitions.transform,
} as const;

const opened = {
  down: '[--disclosure-chevron-bend:-1]',
  up: '[--disclosure-chevron-bend:1]',
  right: 'rotate-90',
} as const;

const expanded = {
  down: 'in-aria-expanded:[--disclosure-chevron-bend:-1] in-[details[open]>summary]:[--disclosure-chevron-bend:-1]',
  up: 'in-aria-expanded:[--disclosure-chevron-bend:1] in-[details[open]>summary]:[--disclosure-chevron-bend:1]',
  right: 'in-aria-expanded:rotate-90 in-[details[open]>summary]:rotate-90',
} as const;

export interface DisclosureChevronProps extends Omit<ComponentProps<'svg'>, 'ref'> {
  /** Where the chevron points while closed (default: down). Down and up bend into each other, right turns 90°. */
  direction?: DisclosureChevronDirection;
  /**
   * Overrides the trigger's state. Leave unset: the chevron follows the nearest
   * `aria-expanded="true"` ancestor, which every Base UI trigger sets, or an open `<details>`'s summary.
   */
  open?: boolean;
}

/** The chevron in an expandable trigger (menu, select, collapsible, "show more") that moves as it opens. */
export function DisclosureChevron({ direction = 'down', open, className, ...props }: DisclosureChevronProps) {
  const Icon = direction === 'right' ? IconChevronRightMedium : BendingChevron;

  return (
    <Icon
      aria-hidden
      data-slot="disclosure-chevron"
      className={cn(
        'shrink-0',
        base[direction],
        'motion-reduce:transition-none',
        open === undefined ? expanded[direction] : open && opened[direction],
        className,
      )}
      {...props}
    />
  );
}
