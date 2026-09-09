import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { DropdownMenu } from '../DropdownMenu/dropdown-menu';
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

const insetIndicatorJoin =
  "group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:pointer-events-none group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:top-1 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bottom-auto group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:h-[calc(var(--active-tab-height)+18px)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-b-none group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:[--tabs-indicator-y:0px] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:[--join-left:min(18px,max(0px,calc(var(--active-tab-left)-var(--tabs-scroll-left,0px)-4px)))] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:[--join-right:min(18px,max(0px,calc(100cqw+var(--tabs-scroll-left,0px)-var(--active-tab-left)-var(--active-tab-width)-4px)))] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:content-[''] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:absolute group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:bottom-[10px] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:right-full group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:w-[var(--join-left)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:h-[var(--join-left)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:before:bg-[radial-gradient(circle_at_top_left,transparent_var(--join-left),var(--surface2)_calc(var(--join-left)+0.5px))] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:content-[''] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:absolute group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:bottom-[10px] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:left-full group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:w-[var(--join-right)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:h-[var(--join-right)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:bg-[radial-gradient(circle_at_top_right,transparent_var(--join-right),var(--surface2)_calc(var(--join-right)+0.5px))]";

export const TabList = ({ children, className, variant, sticky, style }: TabListProps) => {
  const resolvedVariant = variant ?? 'line';
  const scrollRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const overflowPosition = useRef<number | null>(null);
  const overflowAnimation = useRef<Animation | null>(null);
  const [hiddenTabs, setHiddenTabs] = useState<HTMLElement[]>([]);

  useLayoutEffect(() => {
    const overflow = overflowRef.current;
    if (!overflow) {
      overflowPosition.current = null;
      overflowAnimation.current?.cancel();
      return;
    }
    const next = overflow.offsetLeft;
    const previous = overflowPosition.current;
    const shift = overflowAnimation.current
      ? overflow.getBoundingClientRect().left - (overflow.parentElement?.getBoundingClientRect().left ?? 0) - next
      : 0;
    overflowAnimation.current?.cancel();
    overflowPosition.current = next;
    if (previous !== null && previous !== next && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      overflowAnimation.current = overflow.animate(
        [{ transform: `translateX(${previous - next + shift}px)` }, { transform: 'translateX(0)' }],
        { duration: 200, easing: 'cubic-bezier(0, 0, 0.2, 1)' },
      );
    }
  }, [hiddenTabs]);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const list = viewport.querySelector('[role="tablist"]');
    if (!list) return;
    if (viewport.closest('[data-appearance="contained"]') === null) return;
    const measure = () => {
      const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'));
      tabs.forEach(tab => {
        tab.style.display = '';
      });
      const widths = new Map(tabs.map(tab => [tab, tab.getBoundingClientRect().width]));
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const available = viewport.clientWidth;
      const total = tabs.reduce((sum, tab) => sum + (widths.get(tab) ?? 0) + gap, 30);
      const visible = new Set<HTMLElement>();
      let remaining = available - (total > available ? 52 : 0) - 30;
      const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
      if (active) {
        visible.add(active);
        remaining -= (widths.get(active) ?? 0) + gap;
      }
      for (const tab of tabs) {
        if (tab === active) continue;
        const width = (widths.get(tab) ?? 0) + gap;
        if (width > remaining) break;
        visible.add(tab);
        remaining -= width;
      }
      const hidden = tabs.filter(tab => !visible.has(tab));
      hidden.forEach(tab => {
        tab.style.display = 'none';
      });
      viewport.scrollLeft = 0;
      viewport.style.setProperty('--tabs-scroll-left', '0px');
      setHiddenTabs(previous =>
        previous.length === hidden.length && previous.every((tab, index) => tab === hidden[index]) ? previous : hidden,
      );
    };
    const resize = new ResizeObserver(measure);
    resize.observe(viewport);
    resize.observe(list);
    const mutation = new MutationObserver(measure);
    mutation.observe(list, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    });
    measure();
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      data-slot="tabs-list-scroll"
      className={cn(
        'w-full overflow-x-auto',
        'group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:-mb-2.5 group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:pb-2.5',
        'group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-tl-xl',
        'group-data-[appearance=contained]/tabs:[scrollbar-width:none] group-data-[appearance=contained]/tabs:[&::-webkit-scrollbar]:hidden',
        'group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:[container-type:inline-size] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:-mb-[14px] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:pb-[14px]',
        'group-data-[appearance=contained]/tabs:relative group-data-[appearance=contained]/tabs:z-10',
        sticky && 'sticky top-0 z-10 bg-surface2',
      )}
    >
      <BaseTabs.List
        data-slot="tabs-list"
        data-variant={resolvedVariant}
        className={cn(
          'group/tabs-list',
          tabListVariants({ variant: resolvedVariant }),
          'group-data-[appearance=contained]/tabs:min-w-full group-data-[appearance=contained]/tabs:items-end group-data-[appearance=contained]/tabs:gap-0 group-data-[appearance=contained]/tabs:border-b-0',
          "group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:mr-[calc(var(--radius-xl)+8px)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:w-max group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:min-w-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:gap-1 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-t-xl group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bg-surface4 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:p-1 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:pointer-events-none group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:absolute group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:bottom-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:left-full group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:size-[var(--radius-xl)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:bg-[radial-gradient(circle_at_top_right,transparent_var(--radius-xl),var(--surface4)_calc(var(--radius-xl)+0.5px))] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:after:content-['']",
          className,
        )}
        style={style}
      >
        {children}
        {hiddenTabs.length > 0 && (
          <div
            ref={overflowRef}
            data-slot="tabs-overflow"
            className="relative z-30 flex h-9 w-12 shrink-0 items-center justify-center pointer-coarse:h-11"
          >
            <DropdownMenu>
              <DropdownMenu.Trigger
                aria-label={`${hiddenTabs.length} more tabs`}
                className="text-ui-sm text-neutral3 hover:bg-surface3 hover:text-neutral5 focus-visible:ring-accent1 flex items-center gap-1 rounded px-1.5 py-1 tabular-nums focus-visible:ring-1 focus-visible:outline-none"
              >
                +{hiddenTabs.length}
                <ChevronDown aria-hidden="true" className="size-3" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {hiddenTabs.map(tab => (
                  <DropdownMenu.Item
                    key={tab.id}
                    disabled={tab.getAttribute('aria-disabled') === 'true'}
                    onClick={() => {
                      tab.click();
                    }}
                  >
                    {tab.textContent}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        )}
        {resolvedVariant === 'line' && (
          <BaseTabs.Indicator
            className={cn(
              'absolute bottom-0 left-0 bg-[var(--tab-indicator-color,var(--neutral3))]',
              'h-0.5 w-[var(--active-tab-width)]',
              'transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none',
              'group-data-[appearance=contained]/tabs:hidden',
              'group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:-bottom-px group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:z-20 group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:mx-px group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:block group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:w-[calc(var(--active-tab-width)-2px)] group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:bg-surface2 group-data-[appearance=contained]/tabs:group-data-[frame=stroke]/tabs:transition-none',
              'group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:pointer-events-none group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bottom-1 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:z-0 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:block group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:h-[var(--active-tab-height)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-[calc(var(--radius-xl)-4px)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bg-surface2 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:ease-out',
              insetIndicatorJoin,
            )}
            data-slot="tabs-indicator"
            style={{ transform: 'translateX(var(--active-tab-left))' }}
          />
        )}
        {(resolvedVariant === 'pill' || resolvedVariant === 'pill-ghost') && (
          <BaseTabs.Indicator
            className={cn(
              'absolute top-1/2 left-0 z-0 rounded-full bg-[var(--tab-indicator-color,var(--surface4))]',
              'h-[calc(100%-0.5rem)] w-[var(--active-tab-width)]',
              'group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:pointer-events-none group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:rounded-[calc(var(--radius-xl)-4px)] group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:bg-surface2 group-data-[appearance=contained]/tabs:group-data-[frame=inset]/tabs:ease-out',
              'transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none',
              insetIndicatorJoin,
            )}
            data-slot="tabs-indicator"
            style={{ transform: 'translateY(var(--tabs-indicator-y, -50%)) translateX(var(--active-tab-left))' }}
          />
        )}
      </BaseTabs.List>
    </div>
  );
};
