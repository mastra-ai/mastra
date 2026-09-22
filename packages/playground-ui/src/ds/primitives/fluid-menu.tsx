/* eslint-disable react-refresh/only-export-components -- provider and its hooks intentionally share this module */
import * as React from 'react';

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight';
import { useFluidHover } from '@/hooks/use-fluid-hover';
import type { UseFluidHoverOptions, UseFluidHoverReturn } from '@/hooks/use-fluid-hover';
import { cn } from '@/lib/utils';

/**
 * Shared Fluid Hover wiring for every popup that lists items (DropdownMenu,
 * ContextMenu, Select, Combobox, Command). One highlight surface travels
 * between rows instead of each row painting its own hover background.
 *
 * Usage inside a popup component:
 *
 * const menu = useFluidMenu();
 * <Popup {...menu.getContainerProps(props, ref)} className={cn(menuPopupClass, menu.containerClassName, className)}>
 * <FluidMenuItems menu={menu}>{children}</FluidMenuItems>
 * </Popup>
 *
 * and on each row: `ref={useFluidMenuItemRef(forwardedRef)}`.
 *
 * The keyboard path stays honest: the library sets `activeAttr` on the row it
 * considers highlighted (Base UI: `data-highlighted`, cmdk: `data-selected`),
 * and the item hook mirrors that onto the fluid highlight, so arrow keys move
 * the same surface the mouse does.
 */
type FluidMenuContextValue = {
  registerItem: UseFluidHoverReturn['registerItem'];
  setActiveIndex: UseFluidHoverReturn['setActiveIndex'];
  activeAttr: string;
  allocateIndex: () => number;
  releaseIndex: (index: number) => void;
};

const FluidMenuContext = React.createContext<FluidMenuContextValue | null>(null);

// Base UI sets a bare `data-disabled`; cmdk sets `data-disabled="true" | "false"`;
// native controls (DataList rows) use the `disabled` property.
function isMenuItemDisabled(element: HTMLElement) {
  return (
    isAttrActive(element, 'data-disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    (element as HTMLButtonElement).disabled === true
  );
}

function isAttrActive(element: HTMLElement, attr: string) {
  const value = element.getAttribute(attr);
  return value !== null && value !== 'false';
}

type MouseHandlers = Pick<
  React.HTMLAttributes<HTMLElement>,
  'onMouseMove' | 'onMouseEnter' | 'onMouseLeave' | 'onClick'
>;

export type UseFluidMenuOptions = {
  /** Attribute the underlying library sets on its highlighted row. */
  activeAttr?: 'data-highlighted' | 'data-selected';
  /** Forwarded to `useFluidHover`; lists with inert rows (subheaders, pagination) pass `false`. */
  gapClick?: UseFluidHoverOptions['gapClick'];
};

export type FluidMenu<T extends HTMLElement = HTMLElement> = {
  hover: UseFluidHoverReturn;
  context: FluidMenuContextValue;
  /** `relative isolate`: positions the highlight and stacks it under the rows. */
  containerClassName: string;
  /** Ref + pointer handlers for the element that holds the rows, merged with the consumer's own. */
  getContainerProps: (
    own: MouseHandlers,
    forwardedRef?: React.ForwardedRef<T>,
  ) => MouseHandlers & { ref: React.Ref<T> };
};

export function useFluidMenu<T extends HTMLElement = HTMLDivElement>({
  activeAttr = 'data-highlighted',
  gapClick,
}: UseFluidMenuOptions = {}): FluidMenu<T> {
  const containerRef = React.useRef<T>(null);
  const hover = useFluidHover(containerRef, { isItemDisabled: isMenuItemDisabled, gapClick });
  const counterRef = React.useRef(0);
  // Indices released by unmounted rows, reused first so virtualized lists that
  // mount/unmount rows while scrolling keep the index space bounded.
  const freeRef = React.useRef<number[]>([]);

  // Only the stable pieces go into context so item callback refs do not churn
  // (and re-register) on every hover-state render.
  const { registerItem, setActiveIndex, handlers } = hover;
  const context = React.useMemo<FluidMenuContextValue>(
    () => ({
      registerItem,
      setActiveIndex,
      activeAttr,
      allocateIndex: () => freeRef.current.pop() ?? counterRef.current++,
      releaseIndex: index => {
        freeRef.current.push(index);
      },
    }),
    [registerItem, setActiveIndex, activeAttr],
  );

  const getContainerProps = React.useCallback<FluidMenu<T>['getContainerProps']>(
    (own, forwardedRef) => ({
      ref: element => {
        containerRef.current = element;
        if (typeof forwardedRef === 'function') forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      },
      onMouseMove: e => {
        own.onMouseMove?.(e);
        handlers.onMouseMove(e);
      },
      onMouseEnter: e => {
        own.onMouseEnter?.(e);
        handlers.onMouseEnter();
      },
      onMouseLeave: e => {
        own.onMouseLeave?.(e);
        handlers.onMouseLeave();
      },
      onClick: e => {
        own.onClick?.(e);
        handlers.onClick(e);
      },
    }),
    [handlers],
  );

  return { hover, context, containerClassName: 'relative isolate', getContainerProps };
}

/**
 * Provides the item registry to the rows and renders the travelling surface.
 * Popups are `bg-popover`; the highlight is the control hover surface on top of it.
 * `-z-1` keeps it under the row content while the container's `isolate`
 * keeps it above the popup background.
 */
export function FluidMenuItems({
  menu,
  className,
  children,
}: {
  menu: Pick<FluidMenu, 'hover' | 'context'>;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <FluidMenuContext.Provider value={menu.context}>
      <FluidHoverHighlight hover={menu.hover} className={cn('-z-1 rounded-lg bg-fill', className)} />
      {children}
    </FluidMenuContext.Provider>
  );
}

/**
 * Callback ref for an item row. Registers the row with the popup's hover
 * state and mirrors the library's highlighted attribute onto it. A no-op
 * outside a provider, so rows still render standalone.
 */
export function useFluidMenuItemRef<T extends HTMLElement>(forwardedRef: React.ForwardedRef<T>) {
  const ctx = React.useContext(FluidMenuContext);
  const indexRef = React.useRef<number | null>(null);
  const observerRef = React.useRef<MutationObserver | null>(null);

  return React.useCallback(
    (element: T | null) => {
      if (typeof forwardedRef === 'function') forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;

      if (!ctx) return;
      const { registerItem, setActiveIndex, activeAttr, allocateIndex, releaseIndex } = ctx;
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!element) {
        if (indexRef.current !== null) {
          registerItem(indexRef.current, null);
          releaseIndex(indexRef.current);
          indexRef.current = null;
        }
        return;
      }

      if (indexRef.current === null) indexRef.current = allocateIndex();
      const index = indexRef.current;
      registerItem(index, element);

      const sync = () => {
        if (isAttrActive(element, activeAttr)) setActiveIndex(index);
      };
      sync();
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(sync);
        observer.observe(element, { attributes: true, attributeFilter: [activeAttr] });
        observerRef.current = observer;
      }
    },
    [ctx, forwardedRef],
  );
}
