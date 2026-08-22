import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { useState } from 'react';
import type { RefCallback } from 'react';

import { useIsomorphicLayoutEffect } from '@/hooks/use-isomorphic-layout-effect';
import { cn } from '@/lib/utils';

const tabListVariants = cva('relative flex items-center text-ui-lg', {
  variants: {
    variant: {
      line: 'w-max min-w-full border-b border-border1',
      pill: 'w-fit gap-1 rounded-full bg-surface2 p-1',
      'pill-ghost': 'w-fit gap-1 rounded-full p-1',
    },
  },
  defaultVariants: {
    variant: 'line',
  },
});

type TabListVariantsProps = VariantProps<typeof tabListVariants>;
type TabListVariantValue = NonNullable<TabListVariantsProps['variant']>;

/**
 * @deprecated `line` remains the omitted fallback for backward compatibility.
 * Pass `variant="pill"` or `variant="pill-ghost"` for new tabs.
 */
export type DeprecatedLineTabListVariant = Extract<TabListVariantValue, 'line'>;

export type TabListVariant = DeprecatedLineTabListVariant | Exclude<TabListVariantValue, DeprecatedLineTabListVariant>;

export type TabListProps = Omit<TabListVariantsProps, 'variant'> & {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
  /**
   * Visual treatment for the tab list.
   *
   * Defaults to `line` only for backward compatibility. New tabs should pass
   * `variant="pill"` or `variant="pill-ghost"` explicitly.
   */
  variant?: TabListVariant | null;
  /**
   * Optional inline styles applied to the underlying tab list element.
   * To override the active tab indicator color, set the `--tab-indicator-color`
   * CSS variable, e.g. `style={{ '--tab-indicator-color': 'var(--accent5)' } as React.CSSProperties}`.
   */
  style?: React.CSSProperties;
};

/**
 * Tracks which horizontal edges a scroller's content is clipped at, re-measuring
 * on scroll and on resize of either the scroller or its content.
 *
 * Mirrors the `data-overflow-x-*` attributes Base UI's ScrollArea exposes, so a
 * tab list can reuse the same DS mask utilities without adopting the whole
 * ScrollArea — whose viewport would break the `line` variant's full-width
 * underline. Both edges stay `false` while the content fits, which is the common
 * case: a tab bar that does not overflow renders exactly as it did before.
 */
function useOverflowEdges<TElement extends HTMLElement>(): {
  ref: RefCallback<TElement>;
  start: boolean;
  end: boolean;
} {
  const [scroller, setScroller] = useState<TElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useIsomorphicLayoutEffect(() => {
    if (!scroller) return undefined;

    const measure = () => {
      const { scrollLeft, scrollWidth, clientWidth } = scroller;
      // Sub-pixel layout leaves a fraction of scroll range on content that
      // visually fits; a 1px deadzone keeps that from reading as clipped.
      const start = scrollLeft > 1;
      const end = scrollLeft < scrollWidth - clientWidth - 1;
      setEdges(previous => (previous.start === start && previous.end === end ? previous : { start, end }));
    };

    measure();
    scroller.addEventListener('scroll', measure, { passive: true });

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(scroller);
      // The content too: adding or removing a tab changes scrollWidth without
      // ever resizing the scroller.
      if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    }

    return () => {
      scroller.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [scroller]);

  return { ref: setScroller, ...edges };
}

export const TabList = ({ children, className, variant, sticky, style }: TabListProps) => {
  const resolvedVariant = variant ?? 'line';
  const overflow = useOverflowEdges<HTMLDivElement>();

  return (
    <div
      ref={overflow.ref}
      // Fade the edge the list runs past so a clipped tab reads as scrollable
      // instead of cut off mid-word. Same attributes and mask utilities as
      // ScrollArea; neither is set while the list fits.
      data-overflow-x-start={overflow.start || undefined}
      data-overflow-x-end={overflow.end || undefined}
      className={cn(
        'w-full overflow-x-auto',
        'data-[overflow-x-start]:mask-l-from-[calc(100%-2rem)]',
        'data-[overflow-x-end]:mask-r-from-[calc(100%-2rem)]',
        sticky && 'sticky top-0 z-10 bg-surface2',
      )}
    >
      <BaseTabs.List
        data-variant={resolvedVariant}
        className={cn('group/tabs-list', tabListVariants({ variant: resolvedVariant }), className)}
        style={style}
      >
        {children}
        {resolvedVariant === 'line' && (
          <BaseTabs.Indicator
            className={cn(
              'absolute bottom-0 left-0 bg-[var(--tab-indicator-color,var(--neutral3))]',
              'h-0.5 w-[var(--active-tab-width)]',
              'transition-all duration-200 ease-in-out',
            )}
            style={{ transform: 'translateX(var(--active-tab-left))' }}
          />
        )}
        {(resolvedVariant === 'pill' || resolvedVariant === 'pill-ghost') && (
          <BaseTabs.Indicator
            className={cn(
              'absolute top-1/2 left-0 z-0 rounded-full bg-[var(--tab-indicator-color,var(--surface4))]',
              'h-[calc(100%-0.5rem)] w-[var(--active-tab-width)]',
              'transition-all duration-200 ease-in-out',
            )}
            style={{ transform: 'translateY(-50%) translateX(var(--active-tab-left))' }}
          />
        )}
      </BaseTabs.List>
    </div>
  );
};
