import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import * as React from 'react';

import { cn } from '../../../lib/utils';
import { PortalContainerProvider } from '../../primitives/portal-container';
import { frameFillStyle, frameSurfaceStyle } from '../../primitives/raised-surface';
import { DataPanelVariantContext } from './data-panel-context';

// `drawer-popup` / `drawer-backdrop` carry the slide + fade transitions.
import '../Drawer/drawer.css';

interface DataPanelBaseProps {
  /** Accessible name (screen-reader only; the visible title comes from `DataPanel.Heading`). */
  title: string;
  /** Accessible description (screen-reader only). */
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export interface DataPanelDrawerProps extends DataPanelBaseProps {
  /** `drawer` (default): a modal side drawer portaled to the right edge of the page. */
  variant?: 'drawer';
  /** Whether the drawer is shown. */
  open: boolean;
  /** Called when the user dismisses the panel (close button, Escape, backdrop, swipe). */
  onClose?: () => void;
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
}

export interface DataPanelInlineProps extends DataPanelBaseProps {
  /**
   * `inline`: the panel card is rendered where it is mounted, in the normal
   * document flow (no portal, backdrop, focus trap or dismissal gestures).
   * Mount/unmount it to show/hide it. It fills its container's height, so give
   * the parent a bounded height for `DataPanel.Content` to scroll.
   */
  variant: 'inline';
  open?: never;
  onClose?: never;
  depth?: never;
  size?: never;
}

export type DataPanelProps = DataPanelDrawerProps | DataPanelInlineProps;

// The edge comes from the surface's `--surface-rim` inset (no CSS border), like `MainCard`.
// `p-px` reserves that rim pixel so the header divider doesn't paint over it.
const CARD_CLASSES = 'flex max-h-full w-full flex-col overflow-hidden p-px';

const DEPTH_WIDTH = { 1: 'w-xl', 2: 'w-lg', 3: 'w-md' } as const;
const SIZE_WIDTH = { half: 'w-1/2', wide: 'w-4/5', full: 'w-full' } as const;
const SIZE_PERCENT = { half: '50%', wide: '80%', full: '100%' } as const;
// Each extra depth level trims a stacked non-`md` panel so the parent peeks out beneath it.
const DEPTH_PEEK_REM = 1.5;

export function DataPanelRoot(props: DataPanelProps) {
  if (props.variant === 'inline') {
    return <DataPanelInline {...props} />;
  }
  return <DataPanelDrawer {...props} />;
}

function DataPanelInline({ title, description, children, className }: DataPanelInlineProps) {
  const descriptionId = React.useId();

  return (
    <DataPanelVariantContext.Provider value="inline">
      <section
        data-slot="data-panel"
        data-variant="inline"
        aria-label={title}
        aria-describedby={description ? descriptionId : undefined}
        // Inline, the card docks beside the app frame, so it shares the frame's rounding.
        className={cn(CARD_CLASSES, frameSurfaceStyle, 'h-full min-h-0 rounded-studio-frame', className)}
      >
        {description && (
          <span id={descriptionId} className="sr-only">
            {description}
          </span>
        )}
        {children}
      </section>
    </DataPanelVariantContext.Provider>
  );
}

function DataPanelDrawer({
  open,
  onClose,
  title,
  description,
  depth = 1,
  size = 'md',
  children,
  className,
}: DataPanelDrawerProps) {
  // Swipe-exempt mount point for nested popups (Select, DropdownMenu, …) so they
  // stay inside Base UI's modal focus region and don't start a drawer swipe on
  // pointerdown. Same pattern as `SideDialogRoot`; see `portal-container.tsx`.
  const [portalHost, setPortalHost] = React.useState<HTMLDivElement | null>(null);

  return (
    <DataPanelVariantContext.Provider value="drawer">
      <DrawerPrimitive.Root
        open={open}
        onOpenChange={nextOpen => {
          if (!nextOpen) onClose?.();
        }}
        swipeDirection="right"
      >
        <DrawerPrimitive.Portal>
          {/* Lighter than the shared `--scrim`: a side panel should keep the page beneath readable. */}
          <DrawerPrimitive.Backdrop className="drawer-backdrop fixed inset-0 z-50 bg-scrim/30" />
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
                  className={cn(CARD_CLASSES, frameFillStyle, 'rounded-xl shadow-overlay', className)}
                >
                  {children}
                </DrawerPrimitive.Content>
              </PortalContainerProvider>
            </DrawerPrimitive.Popup>
          </DrawerPrimitive.Viewport>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </DataPanelVariantContext.Provider>
  );
}
