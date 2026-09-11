import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { ChevronDown, X } from 'lucide-react';
import { Fragment, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DropdownMenu } from '../DropdownMenu/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip/tooltip';
import { TabListContext, TabsContext } from './tabs-context';
import type { TabMeasurement } from './tabs-context';
import { transitions } from '@/ds/primitives/transitions';
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
  const closeRefs = useRef(new Map<string, HTMLDivElement>());
  const [activeCloseValue, setActiveCloseValue] = useState<string | null>(null);
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
        existing.onClick === tab.onClick &&
        existing.onClose === tab.onClose
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
  const visibleClosableTabs = measurements.filter(tab => !hiddenValues.has(tab.value) && tab.onClose);
  const listContext = useMemo(() => ({ hiddenValues, register, unregister }), [hiddenValues, register, unregister]);
  useLayoutEffect(() => {
    for (const tab of visibleClosableTabs) {
      const close = closeRefs.current.get(tab.value);
      if (!close) continue;
      close.style.left = `${tab.element.offsetLeft}px`;
      close.style.top = `${tab.element.offsetTop}px`;
      close.style.width = `${tab.element.offsetWidth}px`;
      close.style.height = `${tab.element.offsetHeight}px`;
    }
  }, [visibleClosableTabs]);

  return (
    <TabListContext.Provider value={listContext}>
      <TooltipProvider delay={200}>
        <div
          ref={scrollRef}
          data-slot="tabs-list-scroll"
          className={cn('relative w-full overflow-x-auto', sticky && 'sticky top-0 z-10 bg-surface2')}
          onPointerMove={event => {
            if (!(event.target instanceof Element)) return;
            const item = event.target.closest<HTMLElement>('[data-tab-value]');
            setActiveCloseValue(item?.dataset.tabValue ?? null);
          }}
          onPointerLeave={() => setActiveCloseValue(null)}
          onFocusCapture={event => {
            if (!(event.target instanceof Element)) return;
            const item = event.target.closest<HTMLElement>('[data-tab-value]');
            setActiveCloseValue(item?.dataset.tabValue ?? null);
          }}
          onBlurCapture={event => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setActiveCloseValue(null);
          }}
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
          <div data-slot="tabs-close-actions">
            {visibleClosableTabs.map(tab => (
              <div
                key={tab.value}
                ref={element => {
                  if (element) closeRefs.current.set(tab.value, element);
                  else closeRefs.current.delete(tab.value);
                }}
                data-slot="tab-close-item"
                data-tab-value={tab.value}
                data-visible={activeCloseValue === tab.value || undefined}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        tabIndex={activeCloseValue === tab.value ? 0 : -1}
                        data-slot="tab-close"
                        onClick={tab.onClose}
                        className={cn('rounded p-0.5 hover:bg-surface4 hover:text-accent2', transitions.colors)}
                      />
                    }
                  >
                    <span className="sr-only">Close {tab.label}</span>
                    <X aria-hidden="true" className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>Close {tab.label}</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
          {hiddenTabs.length > 0 && (
            <div
              data-slot="tabs-overflow"
              style={{ transform: `translateX(${overflowX}px)` }}
              className="tabs-overflow"
            >
              <DropdownMenu>
                <DropdownMenu.Trigger
                  aria-label={`${hiddenTabs.length} more tabs`}
                  className="text-ui-sm text-neutral3 hover:bg-surface3 hover:text-neutral5 focus-visible:ring-accent1 flex items-center gap-1 rounded px-1.5 py-1 tabular-nums focus-visible:ring-1 focus-visible:outline-none"
                >
                  +{hiddenTabs.length}
                  <ChevronDown aria-hidden="true" className="size-3" />
                </DropdownMenu.Trigger>
                <DropdownMenu.Content className="grid">
                  {hiddenTabs.map((tab, index) => (
                    <Fragment key={tab.value}>
                      <DropdownMenu.Item
                        data-slot="tabs-overflow-tab"
                        disabled={tab.disabled}
                        className={tab.onClose ? 'pr-9' : undefined}
                        style={{ gridArea: `${index + 1} / 1` }}
                        onClick={() => {
                          tabs?.select(tab.value);
                          tab.onClick?.();
                        }}
                      >
                        {tab.label}
                      </DropdownMenu.Item>
                      {tab.onClose ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <DropdownMenu.Item
                                data-slot="tabs-overflow-close"
                                className="hover:text-accent2 data-[highlighted]:text-accent2 pointer-events-none z-10 m-1 size-6 self-center justify-self-end p-0 opacity-0"
                                style={{ gridArea: `${index + 1} / 1` }}
                                onClick={tab.onClose}
                              />
                            }
                          >
                            <span className="sr-only">Close {tab.label}</span>
                            <X aria-hidden="true" className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent side="right">Close {tab.label}</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </Fragment>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          )}
        </div>
      </TooltipProvider>
    </TabListContext.Provider>
  );
};
