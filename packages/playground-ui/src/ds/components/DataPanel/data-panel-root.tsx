import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import * as React from 'react';

import { PortalContainerProvider } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

// `drawer-popup` / `drawer-backdrop` carry the slide + fade transitions.
import '../Drawer/drawer.css';

export interface DataPanelProps {
  /** Whether the panel is shown. The panel is always a modal Drawer dialog. */
  open: boolean;
  /** Called when the user dismisses the panel (close button, Escape, backdrop, swipe). */
  onClose?: () => void;
  /** Accessible dialog name (screen-reader only; the visible title comes from `DataPanel.Heading`). */
  title: string;
  /** Accessible dialog description (screen-reader only). */
  description?: string;
  /**
   * Elevation level when several sibling panels are open at once (not nested in
   * the React tree, so Base UI's own stacking doesn't apply). A deeper panel is
   * narrower so the one beneath peeks out on the left. Siblings stack in mount
   * order: render the deeper panel after the shallower one.
   */
  depth?: 1 | 2 | 3;
  /**
   * Drawer width. `md` (default) is a narrow detail panel whose width shrinks
   * with `depth`. `half`/`wide`/`full` are for multi-column content (e.g. the
   * trace panel); each `depth` level trims them by a small fixed amount so a
   * same-size parent still peeks out beneath. Changing `size` while open
   * animates the width.
   */
  size?: 'md' | 'half' | 'wide' | 'full';
  children: React.ReactNode;
  className?: string;
}

const DEPTH_WIDTH = { 1: 'w-xl', 2: 'w-lg', 3: 'w-md' } as const;
const SIZE_WIDTH = { half: 'w-1/2', wide: 'w-4/5', full: 'w-full' } as const;
const SIZE_PERCENT = { half: '50%', wide: '80%', full: '100%' } as const;
// Each extra depth level trims a stacked non-`md` panel so the parent peeks out beneath it.
const DEPTH_PEEK_REM = 1.5;

export function DataPanelRoot({
  open,
  onClose,
  title,
  description,
  depth = 1,
  size = 'md',
  children,
  className,
}: DataPanelProps) {
  // Swipe-exempt mount point for nested popups (Select, DropdownMenu, …) so they
  // stay inside Base UI's modal focus region and don't start a drawer swipe on
  // pointerdown. Same pattern as `SideDialogRoot`; see `portal-container.tsx`.
  const [portalHost, setPortalHost] = React.useState<HTMLDivElement | null>(null);

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose?.();
      }}
      swipeDirection="right"
    >
      <DrawerPrimitive.Portal>
        {/* Lighter than the shared `--overlay`: a side panel should keep the page beneath readable. */}
        <DrawerPrimitive.Backdrop className="drawer-backdrop bg-overlay/30 fixed inset-0 z-50" />
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50">
          <DrawerPrimitive.Popup
            data-slot="data-panel-popup"
            data-depth={depth}
            data-size={size}
            className={cn(
              'drawer-popup fixed inset-y-0 right-0 z-50 flex max-w-full p-4 outline-none',
              size === 'md' ? DEPTH_WIDTH[depth] : SIZE_WIDTH[size],
            )}
            style={
              size !== 'md' && depth > 1
                ? { width: `calc(${SIZE_PERCENT[size]} - ${(depth - 1) * DEPTH_PEEK_REM}rem)` }
                : undefined
            }
          >
            {/* Not a heading: the visible `DataPanel.Heading` already is one; this only names the dialog. */}
            <DrawerPrimitive.Title render={<span />} className="sr-only">
              {title}
            </DrawerPrimitive.Title>
            {description && (
              <DrawerPrimitive.Description className="sr-only">{description}</DrawerPrimitive.Description>
            )}

            <DrawerPrimitive.Content render={<div ref={setPortalHost} className="absolute" />} />

            <PortalContainerProvider container={portalHost}>
              {/* Whole card is swipe-exempt: pointerdown on tabs/buttons/text must not start a dismiss gesture. */}
              <DrawerPrimitive.Content
                render={<section />}
                className={cn(
                  'flex max-h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-background',
                  className,
                )}
              >
                {children}
              </DrawerPrimitive.Content>
            </PortalContainerProvider>
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
