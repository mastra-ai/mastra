import * as React from 'react';

import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import type { ScrollAreaViewportProps } from '@/ds/components/ScrollArea';
import { FluidMenuItems } from '@/ds/primitives/fluid-menu';
import type { FluidMenu } from '@/ds/primitives/fluid-menu';
import { cn } from '@/lib/utils';

// For a popup that scrolls its items through `MenuScrollArea`: the popup only clips, and its
// padding moves inside the scrolled content, so the scrollbar runs along the popup's edge with
// its ends pulled clear of the corners (`scrollbar-inset-xl` in `menuPopupClass`).
export const menuScrollPopupClass = 'flex flex-col overflow-hidden p-0';

type MenuScrollAreaProps = {
  menu: FluidMenu<HTMLDivElement>;
  /** `sm` pairs with a `rounded-md` popup: tighter padding and highlight radius. */
  size?: 'default' | 'sm';
  /** Renders the scrolling element as the library's list, e.g. `<SelectPrimitive.List />`. */
  viewportRender?: ScrollAreaViewportProps['render'];
  children?: React.ReactNode;
};

/**
 * The scrolling body of DropdownMenu, ContextMenu and Select popups, matching Combobox: a
 * ScrollArea instead of the popup's native overflow, so the scrollbar matches the rest of the
 * app and stays clear of the rounded corners.
 *
 * The root and viewport take the popup's `max-height` (`inherit`), so a popup capped by
 * `menuPopupClass` or by a call site's `max-h-*` scrolls at that height. `h-full` lets the
 * body fill a popup whose height is set outright (Select aligned with its trigger).
 * Flex shrinking also keeps the viewport within the space left by a fixed popup header.
 */
export function MenuScrollArea({ menu, size = 'default', viewportRender, children }: MenuScrollAreaProps) {
  return (
    <ScrollArea className="flex h-full min-h-0 max-h-[inherit] flex-col">
      {/* Keeps a row scrolled into view by the keyboard clear of the 2rem edge fade. */}
      <ScrollAreaViewport className="min-h-0 max-h-[inherit] scroll-py-8" render={viewportRender}>
        {/* A one-column grid stacks rows like a block, and lets a row share a cell with another
            (Tabs' overflow menu lays each tab's close button over its row). `minmax(0,1fr)` keeps
            long rows truncating instead of widening the popup. */}
        <div
          className={cn(menu.containerClassName, 'grid grid-cols-[minmax(0,1fr)]', size === 'sm' ? 'p-0.5' : 'p-1')}
          {...menu.getContainerProps({})}
        >
          <FluidMenuItems menu={menu} className={size === 'sm' ? 'rounded-sm' : undefined}>
            {children}
          </FluidMenuItems>
        </div>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
