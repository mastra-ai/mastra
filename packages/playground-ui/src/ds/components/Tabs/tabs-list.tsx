import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { ChevronDown, X } from 'lucide-react';
import { Fragment, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DropdownMenu } from '../DropdownMenu/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip/tooltip';
import { TabListContext, TabsContext } from './tabs-context';
import type { TabMeasurement } from './tabs-context';
import { controlHeight } from '@/ds/primitives/control-size';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const tabListVariants = cva('relative flex items-center text-body', {
  variants: {
    variant: {
      pill: 'w-fit gap-1 rounded-full bg-fill-subtle p-1',
      'pill-ghost': 'w-fit gap-0.5 rounded-full',
    },
  },
  defaultVariants: {
    variant: 'pill',
  },
});

type TabListVariantsProps = VariantProps<typeof tabListVariants>;

export type TabListVariant = NonNullable<TabListVariantsProps['variant']>;

/** The shared control rung: a list of a size lines up with a Button or Input of that size. */
export type TabListSize = 'sm' | 'md';

export type TabListProps = Omit<TabListVariantsProps, 'variant'> & {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
  size?: TabListSize;
  variant?: TabListVariant | null;
  style?: React.CSSProperties;
};

/** The active pill sits inside the track's inset: 2px on the rung-sized track, 4px when contained. */
function indicatorHeightClass(variant: TabListVariant, contained: boolean) {
  if (variant !== 'pill') return 'h-full';
  return contained ? 'h-[calc(100%-0.5rem)]' : 'h-[calc(100%-0.25rem)]';
}

export const TabList = ({ children, className, variant, size = 'md', sticky, style }: TabListProps) => {
  const resolvedVariant = variant ?? 'pill';
  const tabs = useContext(TabsContext);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRefs = useRef(new Map<string, HTMLDivElement>());
  const tabPositions = useRef(new Map<string, number>());
  const selectedValue = useRef(tabs?.value);
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
  const pillTrack = resolvedVariant === 'pill' && !contained;
  const indicatorHeight = indicatorHeightClass(resolvedVariant, contained);
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport || !contained) return;
    const measure = () => setAvailable(viewport.clientWidth);
    measure();
    if (!('ResizeObserver' in globalThis)) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [contained]);
  const gap = contained ? 4 : 0;
  const frameReserve = contained ? 30 : 0;
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
    .reduce((sum, tab) => sum + tab.width + gap, contained ? 4 : 0);
  const visibleClosableTabs = measurements.filter(tab => !hiddenValues.has(tab.value) && tab.onClose);
  const listContext = useMemo(
    () => ({ variant: resolvedVariant, size, hiddenValues, register, unregister }),
    [resolvedVariant, size, hiddenValues, register, unregister],
  );
  useLayoutEffect(() => {
    const nextPositions = new Map(tabPositions.current);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    for (const tab of measurements) {
      if (hiddenValues.has(tab.value)) continue;
      const left = tab.element.offsetLeft;
      const previousLeft = tabPositions.current.get(tab.value);
      const close = closeRefs.current.get(tab.value);
      if (close) {
        close.style.left = `${left}px`;
        close.style.top = `${tab.element.offsetTop}px`;
        close.style.width = `${tab.element.offsetWidth}px`;
        close.style.height = `${tab.element.offsetHeight}px`;
      }
      const delta = previousLeft === undefined ? 0 : previousLeft - left;
      const shouldAnimate = tab.value !== tabs?.value && Math.abs(delta) <= 32;
      if (!reduceMotion && shouldAnimate && delta !== 0 && 'animate' in tab.element) {
        tab.element.animate([{ transform: `translateX(${delta}px)` }, { transform: 'translateX(0)' }], {
          duration: 180,
          easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        });
      }
      nextPositions.set(tab.value, left);
    }
    for (const value of nextPositions.keys()) {
      if (!measurements.some(tab => tab.value === value)) nextPositions.delete(value);
    }
    tabPositions.current = nextPositions;
  }, [hiddenValues, measurements, tabs?.value]);
  useLayoutEffect(() => {
    const previousValue = selectedValue.current;
    selectedValue.current = tabs?.value;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!contained || previousValue === tabs?.value || reduceMotion) return;
    const indicator = scrollRef.current?.querySelector<HTMLElement>('[data-slot="tabs-indicator"]');
    if (!indicator || !('animate' in indicator)) return;
    indicator.animate(
      [
        { opacity: 0.72, scale: '0.97' },
        { opacity: 1, scale: '1' },
      ],
      {
        duration: 140,
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    );
  }, [contained, tabs?.value]);

  return (
    <TabListContext.Provider value={listContext}>
      <TooltipProvider delay={200}>
        <div
          ref={scrollRef}
          data-slot="tabs-list-scroll"
          className={cn('relative w-full overflow-x-auto', sticky && 'sticky top-0 z-10 bg-background')}
        >
          <BaseTabs.List
            data-slot="tabs-list"
            data-overflow={hiddenTabs.length > 0 || undefined}
            data-variant={resolvedVariant}
            data-size={size}
            className={cn(
              'group/tabs-list',
              tabListVariants({ variant: resolvedVariant }),
              // A filled pill track is the control: its outer box takes the rung (like SegmentedControl),
              // and the tabs fill it inside the 2px inset.
              pillTrack && cn(controlHeight[size], 'items-stretch p-0.5'),
              className,
            )}
            style={style}
          >
            {children}
            <BaseTabs.Indicator
              className={cn(
                'absolute top-1/2 left-0 z-0 rounded-full bg-[var(--tab-indicator-color,var(--fill-hover))]',
                indicatorHeight,
                'w-[var(--active-tab-width)]',
                'transition-[width,transform] duration-200 ease-in-out motion-reduce:transition-none',
              )}
              data-slot="tabs-indicator"
              style={{ transform: 'translateY(var(--tabs-indicator-y, -50%)) translateX(var(--active-tab-left))' }}
            />
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
                data-visible={tabs?.value === tab.value || undefined}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        tabIndex={tabs?.value === tab.value ? 0 : -1}
                        data-slot="tab-close"
                        onClick={tab.onClose}
                        className={cn(
                          'rounded p-0.5 hover:bg-fill-hover hover:text-destructive-foreground',
                          transitions.colors,
                        )}
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
                  variant="ghost"
                  size="sm"
                  className="tabular-nums"
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
                                className="pointer-events-none z-10 m-1 size-6 self-center justify-self-end p-0 opacity-0 hover:text-destructive-foreground data-[highlighted]:text-destructive-foreground"
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
