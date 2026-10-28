import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SeriesMarkProps = {
  /**
   * The series color, as drawn on its chart line or bar segment. Without one (a table with no
   * chart), the mark is neutral.
   */
  color?: string;
  /**
   * An icon or logo drawn in `color` on an 18px square tinted with it: a provider logo at 13px
   * (`ProviderMark`), or an entity glyph (agent, workflow, tool) at 12px. Without one, the mark is
   * a small square of `color`.
   */
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * What a table row stands for, before its name: a small color square, or an icon on a tinted
 * square. With `color`, it ties the row to its series on a chart (a chart's table or legend);
 * without, it marks the kind of thing the row is. 18px, inside a table row's text line, so it
 * doesn't make rows taller.
 */
export function SeriesMark({ color, icon, className, style }: SeriesMarkProps) {
  if (icon === undefined || icon === null) {
    return (
      <span
        aria-hidden
        data-slot="series-mark"
        className={cn('inline-block size-2 shrink-0 rounded-[2px]', !color && 'bg-fill-subtle', className)}
        style={{ background: color, ...style }}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-slot="series-mark"
      // Logos ship their own fills; the mark paints every path in the series color (or muted) instead.
      className={cn(
        'grid size-4.5 shrink-0 place-items-center rounded-[4px] [&_svg_*]:fill-current [&_svg_*]:stroke-none',
        !color && 'bg-fill-subtle text-muted-foreground',
        className,
      )}
      style={color ? { background: `color-mix(in oklab, ${color} 18%, transparent)`, color, ...style } : style}
    >
      {icon}
    </span>
  );
}
