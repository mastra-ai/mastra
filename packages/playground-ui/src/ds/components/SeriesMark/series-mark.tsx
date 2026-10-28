import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SeriesMarkProps = {
  /** The series color, as drawn on its chart line or strip segment. */
  color: string;
  /**
   * A logo or icon (e.g. a provider logo, about 14px) drawn in `color` on a square tinted with it.
   * Without one, the mark is a small square of `color`.
   */
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Ties a row to its series on a chart: a small color square, or an icon in the series color on a
 * square tinted with it. For chart tables and legends, so a row reads as the line or segment it
 * stands for.
 */
export function SeriesMark({ color, icon, className, style }: SeriesMarkProps) {
  if (icon === undefined || icon === null) {
    return (
      <span
        aria-hidden
        data-slot="series-mark"
        className={cn('inline-block size-2 shrink-0 rounded-[2px]', className)}
        style={{ background: color, ...style }}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-slot="series-mark"
      // Logos ship their own fills; the mark paints every path in the series color instead.
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-[5px] [&_svg_*]:fill-current [&_svg_*]:stroke-none',
        className,
      )}
      style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color, ...style }}
    >
      {icon}
    </span>
  );
}
