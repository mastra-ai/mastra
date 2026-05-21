import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

import './drawer.css';

export type DrawerSide = 'top' | 'right' | 'bottom' | 'left';

// `side` is the design-system-facing prop. Base UI's `swipeDirection` describes the
// dismissal gesture, which is the opposite of "where the drawer is anchored" only for
// naming — a bottom-anchored sheet is swiped `down` to dismiss.
const sideToSwipeDirection: Record<DrawerSide, 'up' | 'down' | 'left' | 'right'> = {
  top: 'up',
  bottom: 'down',
  left: 'left',
  right: 'right',
};

const DrawerSideContext = React.createContext<DrawerSide>('bottom');

const useDrawerSide = () => React.useContext(DrawerSideContext);

export type DrawerProps<Payload = unknown> = Omit<DrawerPrimitive.Root.Props<Payload>, 'swipeDirection'> & {
  /** Edge the drawer is anchored to. Defaults to `bottom`. */
  side?: DrawerSide;
};

function Drawer<Payload = unknown>({ side = 'bottom', children, ...props }: DrawerProps<Payload>) {
  return (
    <DrawerSideContext.Provider value={side}>
      <DrawerPrimitive.Root swipeDirection={sideToSwipeDirection[side]} {...props}>
        {children}
      </DrawerPrimitive.Root>
    </DrawerSideContext.Provider>
  );
}
Drawer.displayName = 'Drawer';

// Generic (not `forwardRef`) so `handle` / `payload` stay type-safe for detached
// triggers — mirrors the `Select` wrapper's approach to generic Base UI parts.
type DrawerTriggerProps<Payload = unknown> = DrawerPrimitive.Trigger.Props<Payload> & {
  asChild?: boolean;
};

function DrawerTrigger<Payload = unknown>({ asChild, children, ...props }: DrawerTriggerProps<Payload>) {
  const renderProps = asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : {};

  return (
    <DrawerPrimitive.Trigger {...renderProps} {...props}>
      {asChild ? undefined : children}
    </DrawerPrimitive.Trigger>
  );
}
DrawerTrigger.displayName = 'DrawerTrigger';

type DrawerCloseProps = DrawerPrimitive.Close.Props & {
  asChild?: boolean;
};

const DrawerClose = React.forwardRef<HTMLButtonElement, DrawerCloseProps>(({ asChild, children, ...props }, ref) => {
  const renderProps = asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : {};

  return (
    <DrawerPrimitive.Close ref={ref} {...renderProps} {...props}>
      {asChild ? undefined : children}
    </DrawerPrimitive.Close>
  );
});
DrawerClose.displayName = 'DrawerClose';

const DrawerPortal = DrawerPrimitive.Portal;
const DrawerProvider = DrawerPrimitive.Provider;
const DrawerIndent = DrawerPrimitive.Indent;
const DrawerIndentBackground = DrawerPrimitive.IndentBackground;
const DrawerSwipeArea = DrawerPrimitive.SwipeArea;
const createDrawerHandle = DrawerPrimitive.createHandle;

type DrawerBackdropProps = Omit<DrawerPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

const DrawerBackdrop = React.forwardRef<HTMLDivElement, DrawerBackdropProps>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Backdrop
    ref={ref}
    data-slot="drawer-backdrop"
    className={cn('drawer-backdrop fixed inset-0 z-50 bg-overlay backdrop-blur-xs', className)}
    {...props}
  />
));
DrawerBackdrop.displayName = 'DrawerBackdrop';

const viewportSideClasses: Record<DrawerSide, string> = {
  top: 'items-start justify-center',
  bottom: 'items-end justify-center',
  left: 'items-stretch justify-start',
  right: 'items-stretch justify-end',
};

type DrawerViewportProps = Omit<DrawerPrimitive.Viewport.Props, 'className'> & {
  className?: string;
};

// `pointer-events-none` lets outside clicks fall through to the backdrop element so
// click-to-dismiss works; the popup re-enables pointer events for itself.
const DrawerViewport = React.forwardRef<HTMLDivElement, DrawerViewportProps>(({ className, ...props }, ref) => {
  const side = useDrawerSide();
  return (
    <DrawerPrimitive.Viewport
      ref={ref}
      data-slot="drawer-viewport"
      className={cn('pointer-events-none fixed inset-0 z-50 flex', viewportSideClasses[side], className)}
      {...props}
    />
  );
});
DrawerViewport.displayName = 'DrawerViewport';

const popupSideClasses: Record<DrawerSide, string> = {
  top: 'w-full max-h-[85vh] rounded-b-xl border-b',
  bottom: 'w-full max-h-[85vh] rounded-t-xl border-t',
  left: 'h-full w-3/4 max-w-sm rounded-r-xl border-r',
  right: 'h-full w-3/4 max-w-sm rounded-l-xl border-l',
};

type DrawerPopupProps = Omit<DrawerPrimitive.Popup.Props, 'className'> & {
  className?: string;
};

const DrawerPopup = React.forwardRef<HTMLDivElement, DrawerPopupProps>(({ className, ...props }, ref) => {
  const side = useDrawerSide();
  return (
    <DrawerPrimitive.Popup
      ref={ref}
      data-slot="drawer-popup"
      className={cn(
        'drawer-popup pointer-events-auto relative z-50 flex flex-col overflow-y-auto outline-none',
        'border-border1 bg-surface3 text-neutral5 shadow-dialog',
        popupSideClasses[side],
        className,
      )}
      {...props}
    />
  );
});
DrawerPopup.displayName = 'DrawerPopup';

type DrawerContentProps = Omit<DrawerPrimitive.Popup.Props, 'className'> & {
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

const DrawerHandle = () => <div className="mx-auto my-2 h-1 w-12 shrink-0 rounded-full bg-surface5" />;

/**
 * Convenience composition of Portal + Backdrop + Viewport + Popup. For layouts that
 * need a fixed header / scrollable body (e.g. snap points), compose the styled parts
 * (`DrawerPortal`, `DrawerBackdrop`, `DrawerViewport`, `DrawerPopup`) directly instead.
 */
const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(
  ({ className, children, container, hideBackdrop, hideCloseButton, hideHandle, ...props }, ref) => {
    const side = useDrawerSide();
    const showHandle = !hideHandle && (side === 'top' || side === 'bottom');

    return (
      <DrawerPortal container={container ?? undefined}>
        {!hideBackdrop && <DrawerBackdrop />}
        <DrawerViewport>
          <DrawerPopup ref={ref} className={className} {...props}>
            {showHandle && side === 'bottom' && <DrawerHandle />}
            {children}
            {showHandle && side === 'top' && <DrawerHandle />}
            {!hideCloseButton && (
              <DrawerPrimitive.Close
                render={
                  <Button variant="ghost" size="sm" className="absolute top-3 right-3" aria-label="Close">
                    <X />
                  </Button>
                }
              />
            )}
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    );
  },
);
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="drawer-header" className={cn('flex flex-col gap-0.5 px-4 py-3 text-left', className)} {...props} />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="drawer-footer"
    className={cn('mt-auto flex flex-col-reverse gap-1.5 px-4 py-3 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="drawer-body" className={cn('flex-1 overflow-y-auto px-4 py-3', className)} {...props} />
);
DrawerBody.displayName = 'DrawerBody';

type DrawerTitleProps = Omit<DrawerPrimitive.Title.Props, 'className'> & {
  className?: string;
};

const DrawerTitle = React.forwardRef<HTMLHeadingElement, DrawerTitleProps>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title ref={ref} className={cn('text-ui-md font-medium text-neutral6', className)} {...props} />
));
DrawerTitle.displayName = 'DrawerTitle';

type DrawerDescriptionProps = Omit<DrawerPrimitive.Description.Props, 'className'> & {
  className?: string;
};

const DrawerDescription = React.forwardRef<HTMLParagraphElement, DrawerDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DrawerPrimitive.Description ref={ref} className={cn('text-ui-sm text-neutral3', className)} {...props} />
  ),
);
DrawerDescription.displayName = 'DrawerDescription';

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerBackdrop,
  DrawerViewport,
  DrawerPopup,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
  DrawerProvider,
  DrawerIndent,
  DrawerIndentBackground,
  DrawerSwipeArea,
  createDrawerHandle,
};

export type {
  DrawerTriggerProps,
  DrawerCloseProps,
  DrawerBackdropProps,
  DrawerViewportProps,
  DrawerPopupProps,
  DrawerContentProps,
  DrawerTitleProps,
  DrawerDescriptionProps,
};
