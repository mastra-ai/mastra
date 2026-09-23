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
 * or moves focus onto it (roving-focus lists), and the item hook mirrors that
 * onto the fluid highlight, so arrow keys move the same surface the mouse does.
 *
 * A row whose submenu is open (`data-popup-open`) holds the highlight once the
 * pointer leaves for the submenu, so the path to the open submenu stays lit
 * on the one surface instead of a second background painted by the row.
 */
type FluidMenuContextValue = {
  registerItem: UseFluidHoverReturn['registerItem'];
  setActiveIndex: UseFluidHoverReturn['setActiveIndex'];
  activeAttr: string;
  allocateIndex: () => number;
  releaseIndex: (index: number) => void;
  setHeld: (index: number, held: boolean) => void;
};

const POPUP_OPEN_ATTR = 'data-popup-open';

const FluidMenuContext = React.createContext<FluidMenuContextValue | undefined>(undefined);

// Base UI sets a bare `data-disabled`; cmdk sets `data-disabled="true" | "false"`;
// native controls (DataList rows) use the `disabled` property.
function isMenuItemDisabled(element: HTMLElement) {
  return (
    isAttrActive(element, 'data-disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    ('disabled' in element && element.disabled === true)
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
  const heldIndexRef = React.useRef<number | undefined>(undefined);
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
      setHeld: (index, held) => {
        if (held) heldIndexRef.current = index;
        else if (heldIndexRef.current === index) heldIndexRef.current = undefined;
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
        handlers.onMouseEnter(e);
      },
      onMouseLeave: e => {
        own.onMouseLeave?.(e);
        handlers.onMouseLeave(e);
        if (heldIndexRef.current !== undefined) setActiveIndex(heldIndexRef.current);
      },
      onClick: e => {
        own.onClick?.(e);
        handlers.onClick(e);
      },
    }),
    [handlers, setActiveIndex],
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
export function useFluidMenuItemRef<T extends HTMLElement>(forwardedRef?: React.ForwardedRef<T>) {
  const ctx = React.useContext(FluidMenuContext);
  const indexRef = React.useRef<number | undefined>(undefined);
  const unsubscribeRef = React.useRef<(() => void) | undefined>(undefined);

  return React.useCallback(
    (element: T | null) => {
      if (typeof forwardedRef === 'function') forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;

      if (!ctx) return;
      const { registerItem, setActiveIndex, activeAttr, allocateIndex, releaseIndex, setHeld } = ctx;
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;

      if (!element) {
        if (indexRef.current !== undefined) {
          setHeld(indexRef.current, false);
          registerItem(indexRef.current, null);
          releaseIndex(indexRef.current);
          indexRef.current = undefined;
        }
        return;
      }

      indexRef.current ??= allocateIndex();
      const index = indexRef.current;
      registerItem(index, element);

      const sync = () => {
        setHeld(index, element.hasAttribute(POPUP_OPEN_ATTR));
        if (isAttrActive(element, activeAttr)) setActiveIndex(index);
      };
      const light = () => setActiveIndex(index);
      sync();
      element.addEventListener('focusin', light);
      const observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(sync);
      observer?.observe(element, { attributes: true, attributeFilter: [activeAttr, POPUP_OPEN_ATTR] });
      unsubscribeRef.current = () => {
        observer?.disconnect();
        element.removeEventListener('focusin', light);
      };
    },
    [ctx, forwardedRef],
  );
}
