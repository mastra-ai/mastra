// Internal convenience composition used by drawer stories and tests. Not part of
// the public package surface — production drawers (e.g. SideDialog) compose the
// primitives directly so they can place chrome, navigation, and selectable
// content where they need to.

import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import * as React from 'react';

import { DrawerBackdrop, DrawerPopup, DrawerPortal, DrawerViewport, useDrawerSide } from './drawer';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

type DrawerShellProps = Omit<DrawerPrimitive.Popup.Props, 'className'> & {
  className?: string;
  /** Portal target. Defaults to `document.body`. */
  container?: HTMLElement | null;
  /** Hide the dimmed backdrop layer (use for non-modal drawers). */
  hideBackdrop?: boolean;
  /** Hide the built-in close button. */
  hideCloseButton?: boolean;
  /** Hide the drag handle shown on top/bottom sheets. */
  hideHandle?: boolean;
};

// Faded out while a nested drawer is open so the collapsed parent reads as a backdrop.
const nestedFadeClass = cn(
  'transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0',
  'group-data-[nested-drawer-open]/popup:opacity-0',
);

const HandleBar = () => (
  <div className={cn('mx-auto my-2 h-1 w-12 shrink-0 rounded-full bg-surface5', nestedFadeClass)} />
);

const DrawerShell = React.forwardRef<HTMLDivElement, DrawerShellProps>(
  ({ className, children, container, hideBackdrop, hideCloseButton, hideHandle, ...props }, ref) => {
    const side = useDrawerSide();
    const showHandle = !hideHandle && (side === 'top' || side === 'bottom');

    return (
      <DrawerPortal container={container ?? undefined}>
        {!hideBackdrop && <DrawerBackdrop />}
        <DrawerViewport className={hideBackdrop ? 'pointer-events-none' : undefined}>
          <DrawerPopup ref={ref} className={cn(hideBackdrop && 'pointer-events-auto', className)} {...props}>
            {showHandle && side === 'bottom' && <HandleBar />}
            <div data-slot="drawer-content" className={cn('relative flex min-h-0 flex-1 flex-col', nestedFadeClass)}>
              {children}
              {!hideCloseButton && (
                <DrawerPrimitive.Close
                  render={
                    <Button variant="ghost" size="sm" className="absolute top-3 right-3" aria-label="Close">
                      <X />
                    </Button>
                  }
                />
              )}
            </div>
            {showHandle && side === 'top' && <HandleBar />}
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    );
  },
);
DrawerShell.displayName = 'DrawerShell';

export { DrawerShell };
export type { DrawerShellProps };
