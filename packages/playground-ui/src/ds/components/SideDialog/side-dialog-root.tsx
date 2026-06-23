import { ChevronsRightIcon } from 'lucide-react';
import * as React from 'react';
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerDescription,
  DrawerInteractive,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerViewport,
} from '@/ds/components/Drawer';
import { PortalContainerProvider } from '@/ds/primitives/portal-container';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type SideDialogRootProps = {
  variant?: 'default' | 'confirmation';
  dialogTitle: string;
  dialogDescription: string;
  isOpen: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  level?: 1 | 2 | 3;
};

export function SideDialogRoot({
  dialogTitle,
  dialogDescription,
  isOpen,
  onClose,
  children,
  variant = 'default',
  level = 1,
  className,
}: SideDialogRootProps) {
  const isConfirmation = variant === 'confirmation';

  // Mount point for nested popups (Select, Popover, …). It sits *inside* Base
  // UI's modal `FloatingFocusManager` region (so a `document.body` portal can't
  // leave them unclickable) AND is a `DrawerInteractive` (`data-drawer-content`)
  // node, which Base UI's Drawer excludes from swipe-to-dismiss. Without that
  // exclusion, a `pointerdown` on a dropdown option starts a drawer swipe and
  // captures the pointer, so the option never receives `pointerup` and the
  // click never commits. See `portal-container.tsx`.
  const [portalHost, setPortalHost] = React.useState<HTMLDivElement | null>(null);

  return (
    <Drawer
      side="right"
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose?.();
      }}
    >
      <DrawerPortal>
        {!isConfirmation && <DrawerBackdrop className="backdrop-blur-sm" />}
        <DrawerViewport className={isConfirmation ? 'pointer-events-none' : undefined}>
          <DrawerPopup
            className={cn(
              'max-w-none rounded-none border-y-0 border-r-0 border-l border-border2 bg-surface2 overflow-visible',
              {
                'w-[75vw] 2xl:w-[65vw] 4xl:w-[55vw]': level === 1,
                'w-[70vw] 2xl:w-[59vw] 4xl:w-[48vw]': level === 2,
                'w-[65vw] 2xl:w-[53vw] 4xl:w-[41vw]': level === 3,
                'pointer-events-auto bg-surface2/70 backdrop-blur-sm shadow-none': isConfirmation,
              },
              className,
            )}
          >
            <DrawerTitle className="sr-only">{dialogTitle}</DrawerTitle>
            <DrawerDescription className="sr-only">{dialogDescription}</DrawerDescription>

            {!isConfirmation && (
              <DrawerClose
                render={
                  <button
                    type="button"
                    className={cn(
                      'flex appearance-none items-center justify-center rounded-bl-lg h-14 w-14 absolute top-0 -left-14 bg-surface2 text-neutral3 border-l border-b border-border2',
                      transitions.all,
                      'hover:bg-surface4 hover:text-neutral5',
                    )}
                    aria-label="Close"
                  >
                    <ChevronsRightIcon />
                  </button>
                }
              />
            )}

            {/* Swipe-exempt, out-of-flow mount point for nested popups. */}
            <DrawerInteractive render={<div ref={setPortalHost} className="absolute" />} />

            <PortalContainerProvider container={portalHost}>
              <div
                className={cn('grid h-full', {
                  'grid-rows-[auto_1fr]': !isConfirmation,
                })}
              >
                {children}
              </div>
            </PortalContainerProvider>
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    </Drawer>
  );
}
