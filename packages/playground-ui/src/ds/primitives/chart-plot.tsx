import { startTransition, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import type { ChartHeight } from './chart-frame';
import { cn } from '@/lib/utils';

/** How long the box has to hold still before the chart redraws at its new size. */
const SETTLE_MS = 150;

/**
 * Sizes the plot. `fill` takes the parent's free height, out of flow: a ResponsiveContainer at
 * 100% height can round a pixel past its box, which would make the card scroll by a hair.
 */
export function ChartPlot({
  height,
  plotRef,
  onResize,
  clickable,
  className,
  children,
}: {
  height: ChartHeight;
  plotRef: React.Ref<HTMLDivElement>;
  onResize: (width: number, height: number) => void;
  clickable?: boolean;
  /** On the element around the SVG, e.g. to style Recharts' parts from a chart option. */
  className?: string;
  children: ReactNode;
}) {
  // Recharts makes parts of the plot focusable for keyboard use; a mouse click shouldn't leave a
  // focus ring around the chart, keyboard focus still shows one.
  const surface = cn(
    'w-full [&_.recharts-surface]:overflow-visible [&_.recharts-surface]:outline-none',
    '[&_*:focus:not(:focus-visible)]:outline-none',
    clickable && '[&_.recharts-surface]:cursor-pointer',
    className,
  );
  const plot = <StretchedPlot onResize={onResize}>{children}</StretchedPlot>;
  if (height === 'fill') {
    return (
      <div className="relative min-h-45 flex-1">
        <div ref={plotRef} className={cn('absolute inset-0', surface)}>
          {plot}
        </div>
      </div>
    );
  }
  return (
    <div ref={plotRef} className={surface} style={{ height }}>
      {plot}
    </div>
  );
}

/**
 * Draws the chart at the box's size, and again only once the box has stopped resizing: a page of
 * charts can't redraw on every frame of a resize. Meanwhile the drawn chart is scaled to the box in
 * the same frame, so it moves with its card, and its text is scaled back so labels keep their shape.
 */
function StretchedPlot({
  onResize,
  children,
}: {
  onResize: (width: number, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number }>();
  const draw = useEffectEvent((width: number, height: number) => {
    setSize({ width, height });
    onResize(width, height);
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let drawn: { width: number; height: number } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width === drawn?.width && height === drawn?.height) return;
      clearTimeout(timer);
      const commit = () => {
        drawn = { width, height };
        draw(width, height);
      };
      // Nothing is drawn at a zero size (a hidden tab), so there's nothing to stretch: draw now.
      if (!drawn || !isDrawable(drawn)) {
        commit();
        return;
      }
      const x = width / drawn.width;
      const y = height / drawn.height;
      el.style.transform = `scale(${x}, ${y})`;
      el.style.setProperty('--chart-unscale-x', String(1 / x));
      el.style.setProperty('--chart-unscale-y', String(1 / y));
      // Redraw once the resize stops, in a transition so React draws the charts in slices between
      // frames instead of in one long task.
      timer = setTimeout(() => startTransition(commit), SETTLE_MS);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Drop the stretch in the same commit that draws the chart at its new size.
  useLayoutEffect(() => {
    ref.current?.removeAttribute('style');
  }, [size]);

  return (
    <div
      ref={ref}
      className={cn(
        'size-full origin-top-left',
        // Only while stretched (the inline style is set), so labels keep their own transforms otherwise.
        '[&[style]_text]:[transform:scale(var(--chart-unscale-x),var(--chart-unscale-y))]',
        '[&[style]_text]:origin-center [&[style]_text]:[transform-box:fill-box]',
      )}
    >
      {size && isDrawable(size) && (
        <ResponsiveContainer width={size.width} height={size.height}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function isDrawable({ width, height }: { width: number; height: number }) {
  return width > 0 && height > 0;
}
