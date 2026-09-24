import type { ReactNode } from 'react';
import { frameSurfaceStyle, raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type MetricsCardGroupVariant = 'default' | 'inset';

export type MetricsCardGroupProps = {
  children: ReactNode;
  /**
   * `default` — raised cards sitting in a frame one step below them.
   * `inset` — the DataList treatment: the group is the raised surface, and the
   * cards are flat wells cut into it, so the frame reads as a thick border.
   */
  variant?: MetricsCardGroupVariant;
  className?: string;
};

/**
 * Like DataList, the inset group is the only element that defines a color: it
 * repaints its cards as wells, whatever card is dropped in. `!` is needed to beat
 * `Card`'s pinned `hover:`/`active:` fills.
 */
const variantClasses: Record<MetricsCardGroupVariant, string> = {
  default: frameSurfaceStyle,
  // Wells swap the card's elevation for a bare 1px `--surface-rim`: the same edge
  // every raised surface draws, with no lift, so they stay crisp against the frame
  // in light, where `background` and `card` sit only a step apart.
  inset: cn(raisedSurfaceStyle, '*:bg-background! *:shadow-rim!'),
};

/**
 * A frame that holds a row of metrics cards (KPI, chart, …) as one unit.
 * One column below `md`, two below `lg`, then every card on a single row with
 * equal widths. The group owns their width, so each card's own `min-w-*` is neutralised.
 */
export function MetricsCardGroup({ children, variant = 'default', className }: MetricsCardGroupProps) {
  return (
    <div
      // Outer radius = card radius (8px) + 4px inset so the corners stay concentric.
      className={cn(
        'grid grid-cols-1 gap-1 rounded-xl p-1 *:min-w-0! md:grid-cols-2 lg:flex lg:*:flex-1',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
