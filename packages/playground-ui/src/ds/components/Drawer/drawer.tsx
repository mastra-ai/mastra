import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

// Swipe/stack transforms live in CSS (see drawer.css) — too unreadable as escaped
// Tailwind arbitrary values. Everything native stays inline below.
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
// Pointer drags inside select text instead of swiping the drawer closed.
const DrawerContent = DrawerPrimitive.Content;

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

// A plain full-screen flex container, exactly like the Base UI examples. It must NOT
// set `pointer-events: none` for modal drawers — that breaks the swipe gesture. The
// non-modal opt-out (`pointer-events-none` here + `pointer-events-auto` on the popup)
// is applied by `DrawerShell` only when there is no backdrop.
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

// Native popup styles — layout, colour, the `after:` dim overlay. The `drawer-popup`
// class hooks into drawer.css for the swipe/stack transforms and transitions.
const drawerPopupBaseClass = cn(
  'drawer-popup group/popup relative z-50 box-border flex flex-col overflow-y-auto overscroll-contain outline-none [touch-action:auto] will-change-transform',
  'border-border1 bg-surface3 text-neutral5 shadow-dialog',
  'data-[swiping]:select-none',
  // Dim layer drawn over a parent drawer while a nested drawer covers it.
  "after:pointer-events-none after:absolute after:inset-0 after:bg-transparent after:transition-[background-color] after:duration-[450ms] after:content-['']",
  'data-[nested-drawer-open]:after:bg-black/25',
);

// Per-side layout. Top/bottom sheets bleed 3rem past the viewport edge
// (`-mb-12`/`pb-12`) so a stacked parent's border stays flush as it peeks behind.
// The slide/scale transforms for each side live in drawer.css.
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

/**
 * Convenience composition of Portal + Backdrop + Viewport + Popup.
 *
 * Children sit in a plain `<div>`, not Base UI's `Drawer.Content`. `Drawer.Content`
 * marks its subtree as mouse-text-selectable, so a *pointer* drag inside it selects
 * text instead of swiping (touch still swipes). A plain `<div>` keeps the entire
 * panel drag-to-dismiss for pointer and touch alike. Pair this with not putting
 * `pointer-events: none` on a modal viewport — that also blocks the swipe.
 *
 * `hideBackdrop` marks the drawer as non-modal: it drops the backdrop and switches the
 * viewport to `pointer-events: none` (popup re-enables its own) so the page behind
 * stays interactive — the only case where that opt-out is correct.
 *
 * For layouts that need their own structure, compose the styled parts
 * (`DrawerPortal`, `DrawerBackdrop`, `DrawerViewport`, `DrawerPopup`) directly instead.
 */
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
  DrawerShell,
  DrawerHeader,
  DrawerFooter,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
  DrawerProvider,
  DrawerIndent,
  DrawerIndentBackground,
  DrawerSwipeArea,
  DrawerContent,
  createDrawerHandle,
};

export type {
  DrawerTriggerProps,
  DrawerCloseProps,
  DrawerBackdropProps,
  DrawerViewportProps,
  DrawerPopupProps,
  DrawerShellProps,
  DrawerTitleProps,
  DrawerDescriptionProps,
};
