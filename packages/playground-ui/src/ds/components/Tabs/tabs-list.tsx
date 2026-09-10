import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DropdownMenu } from '../DropdownMenu/dropdown-menu';
import { TabListContext, TabsContext } from './tabs-context';
import type { TabMeasurement } from './tabs-context';
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

export const TabList = ({ children, className, variant, sticky, style }: TabListProps) => {
  const resolvedVariant = variant ?? 'line';
  const tabs = useContext(TabsContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<TabMeasurement[]>([]);
  const register = useCallback((tab: TabMeasurement) => {
    setMeasurements(previous => {
      const existing = previous.find(item => item.value === tab.value);
      if (
        existing &&
        existing.element === tab.element &&
        existing.width === tab.width &&
        existing.label === tab.label &&
        existing.disabled === tab.disabled &&
        existing.onClick === tab.onClick
      )
        return previous;
      const next = existing ? previous.map(item => (item.value === tab.value ? tab : item)) : [...previous, tab];
      return next.sort((a, b) => {
        if (a.element === b.element) return 0;
        return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
    });
  }, []);
  const unregister = useCallback(
    (value: string) => setMeasurements(previous => previous.filter(tab => tab.value !== value)),
    [],
  );
  const contained = tabs?.appearance === 'contained';
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !contained) return;
    const measure = () => setAvailable(viewport.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, [contained]);
  const gap = tabs?.frame === 'inset' ? 4 : 0;
  const frameReserve = tabs?.frame === 'inset' ? 30 : 0;
  const hiddenValues = useMemo(() => {
    const hidden = new Set<string>();
    if (!contained || available === null) return hidden;
    const tabTotal = measurements.reduce((sum, tab) => sum + tab.width, 0) + gap * Math.max(measurements.length - 1, 0);
    if (tabTotal + frameReserve <= available) return hidden;
    let remaining = available - frameReserve - 48;
    const active = measurements.find(tab => tab.value === tabs?.value);
    if (active) remaining -= active.width + gap;
    let full = false;
    for (const tab of measurements) {
      if (tab === active) continue;
      if (full || tab.width + gap > remaining) {
        full = true;
        hidden.add(tab.value);
      } else remaining -= tab.width + gap;
    }
    return hidden;
  }, [contained, available, measurements, gap, frameReserve, tabs?.value]);
  const hiddenTabs = measurements.filter(tab => hiddenValues.has(tab.value));
  const overflowX = measurements
    .filter(tab => !hiddenValues.has(tab.value))
    .reduce((sum, tab) => sum + tab.width + gap, tabs?.frame === 'inset' ? 4 : 0);
  const listContext = useMemo(() => ({ hiddenValues, register, unregister }), [hiddenValues, register, unregister]);

  return (
    <TabListContext.Provider value={contained ? listContext : null}>
      <div
        ref={scrollRef}
        data-slot="tabs-list-scroll"
        className={cn('w-full overflow-x-auto', sticky && 'sticky top-0 z-10 bg-surface2')}
      >
        <BaseTabs.List
          data-slot="tabs-list"
          data-overflow={hiddenTabs.length > 0 || undefined}
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
                'transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none',
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
                'transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none',
              )}
              data-slot="tabs-indicator"
              style={{ transform: 'translateY(var(--tabs-indicator-y, -50%)) translateX(var(--active-tab-left))' }}
            />
          )}
        </BaseTabs.List>
        {hiddenTabs.length > 0 && (
          <div data-slot="tabs-overflow" style={{ transform: `translateX(${overflowX}px)` }} className="tabs-overflow">
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
                    key={tab.value}
                    disabled={tab.disabled}
                    onClick={() => {
                      tabs?.select(tab.value);
                      tab.onClick?.();
                    }}
                  >
                    {tab.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        )}
      </div>
    </TabListContext.Provider>
  );
};
