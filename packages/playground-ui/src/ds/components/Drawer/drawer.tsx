import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import * as React from 'react';

import { cn } from '@/lib/utils';

// Swipe/stack transforms live in drawer.css — unreadable as Tailwind arbitrary values.
import './drawer.css';

export type DrawerSide = 'top' | 'right' | 'bottom' | 'left';

// `side` = anchor edge; Base UI's `swipeDirection` = dismissal gesture (bottom sheet swipes `down`).
const sideToSwipeDirection: Record<DrawerSide, 'up' | 'down' | 'left' | 'right'> = {
  top: 'up',
  bottom: 'down',
  left: 'left',
  right: 'right',
};

const DrawerSideContext = React.createContext<DrawerSide>('bottom');

export const useDrawerSide = () => React.useContext(DrawerSideContext);

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

// Generic (not `forwardRef`) so `handle` / `payload` stay type-safe on detached triggers.
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
// Inner region where pointer drags select text / scroll instead of swiping the drawer closed.
const DrawerInteractive = DrawerPrimitive.Content;

type DrawerBackdropProps = Omit<DrawerPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

// The `drawer-backdrop` class (drawer.css) fades the overlay with the swipe gesture.
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

// Must NOT default to `pointer-events-none` — that would break the modal swipe gesture.
// Non-modal callers opt out via className on viewport (none) and popup (auto).
const DrawerViewport = React.forwardRef<HTMLDivElement, DrawerViewportProps>(({ className, ...props }, ref) => {
  const side = useDrawerSide();
  return (
    <DrawerPrimitive.Viewport
      ref={ref}
      data-slot="drawer-viewport"
      className={cn('fixed inset-0 z-50 flex', viewportSideClasses[side], className)}
      {...props}
    />
  );
});
DrawerViewport.displayName = 'DrawerViewport';

// `drawer-popup` hooks into drawer.css for swipe/stack transforms; `::after` dims under nested drawers.
const drawerPopupBaseClass = cn(
  'drawer-popup group/popup relative z-50 box-border flex flex-col overflow-y-auto overscroll-contain outline-none [touch-action:auto] will-change-transform',
  'border-border1 bg-surface3 text-neutral5 shadow-dialog',
  'data-[swiping]:select-none',
  "after:pointer-events-none after:absolute after:inset-0 after:bg-transparent after:transition-[background-color] after:duration-[450ms] after:content-['']",
  'data-[nested-drawer-open]:after:bg-black/25',
);

// Top/bottom sheets bleed 3rem past the edge so a stacked parent's border stays flush behind.
const popupSideClasses: Record<DrawerSide, string> = {
  bottom: 'h-[var(--drawer-height,auto)] max-h-[calc(85vh_+_3rem)] w-full -mb-12 pb-12 rounded-t-xl border-x border-t',
  top: 'h-[var(--drawer-height,auto)] max-h-[calc(85vh_+_3rem)] w-full -mt-12 pt-12 rounded-b-xl border-x border-b',
  left: 'h-full w-[20rem] max-w-[85vw] rounded-r-xl border-y border-r',
  right: 'h-full w-[20rem] max-w-[85vw] rounded-l-xl border-y border-l',
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
      className={cn(drawerPopupBaseClass, popupSideClasses[side], className)}
      {...props}
    />
  );
});
DrawerPopup.displayName = 'DrawerPopup';

// Inner-content fade while a nested drawer covers the parent. Off the popup itself so border/shadow stay crisp.
const nestedFadeClass = cn(
  'transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0',
  'group-data-[nested-drawer-open]/popup:opacity-0',
);

const DrawerHandleBar = () => (
  <div
    aria-hidden
    data-slot="drawer-handle"
    className={cn('mx-auto my-2 h-1 w-12 shrink-0 rounded-full bg-surface5', nestedFadeClass)}
  />
);
DrawerHandleBar.displayName = 'DrawerHandleBar';

type DrawerContentProps = Omit<DrawerPrimitive.Popup.Props, 'className' | 'children'> & {
  className?: string;
  children?: React.ReactNode;
};

// Opinionated bundle: Portal + Backdrop + Viewport + Popup, with handle on top/bottom sheets.
// Drop to the primitives for non-modal pages, custom portal targets, or chrome outside the popup.
const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(({ className, children, ...props }, ref) => {
  const side = useDrawerSide();
  const showHandle = side === 'top' || side === 'bottom';

  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerViewport>
        <DrawerPopup ref={ref} className={className} {...props}>
          {showHandle && side === 'bottom' && <DrawerHandleBar />}
          <div data-slot="drawer-content" className={cn('relative flex min-h-0 flex-1 flex-col', nestedFadeClass)}>
            {children}
          </div>
          {showHandle && side === 'top' && <DrawerHandleBar />}
        </DrawerPopup>
      </DrawerViewport>
    </DrawerPortal>
  );
});
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
  <div data-slot="drawer-body" className={cn('flex-1 px-4 py-3', className)} {...props} />
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
  DrawerInteractive,
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
