import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import * as React from 'react';

import { PortalContainerProvider } from '@/ds/primitives/portal-container';
import { cn } from '@/lib/utils';

export interface DataPanelProps {
  /** Whether the panel is shown. The panel is always a modal Drawer dialog. */
  open: boolean;
  /** Called when the user dismisses the panel (close button, Escape, backdrop, swipe). */
  onClose?: () => void;
  /** Accessible dialog name (screen-reader only; the visible title comes from `DataPanel.Heading`). */
  title: string;
  /** Accessible dialog description (screen-reader only). */
  description?: string;
  collapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function DataPanelRoot({ open, onClose, title, description, collapsed, children, className }: DataPanelProps) {
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
        <DrawerPrimitive.Backdrop className="bg-overlay fixed inset-0 z-50" />
        <DrawerPrimitive.Viewport className="fixed inset-0 z-50">
          <DrawerPrimitive.Popup
            data-slot="data-panel-popup"
            className="fixed inset-y-0 right-0 z-50 flex w-md max-w-full p-4 outline-none"
          >
            <DrawerPrimitive.Title className="sr-only">{title}</DrawerPrimitive.Title>
            {description && (
              <DrawerPrimitive.Description className="sr-only">{description}</DrawerPrimitive.Description>
            )}

            <DrawerPrimitive.Content render={<div ref={setPortalHost} className="absolute" />} />

            <PortalContainerProvider container={portalHost}>
              <section
                className={cn(
                  'flex w-full flex-col overflow-hidden rounded-xl border border-border1 bg-surface2',
                  collapsed ? 'h-auto' : 'max-h-full',
                  className,
                )}
              >
                {children}
              </section>
            </PortalContainerProvider>
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
