import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

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

// Backdrop fades out proportionally to the swipe gesture via `--drawer-swipe-progress`.
const drawerBackdropClass = cn(
  'fixed inset-0 z-50 bg-overlay backdrop-blur-xs',
  '[opacity:calc(1_-_var(--drawer-swipe-progress,0))]',
  'transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0',
  'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
  'data-[swiping]:duration-0 data-[ending-style]:duration-[calc(var(--drawer-swipe-strength,1)*400ms)]',
);

type DrawerBackdropProps = Omit<DrawerPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

const DrawerBackdrop = React.forwardRef<HTMLDivElement, DrawerBackdropProps>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Backdrop ref={ref} data-slot="drawer-backdrop" className={cn(drawerBackdropClass, className)} {...props} />
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

// Shared popup styles. The stacking custom properties evaluate to a no-op for an
// unnested drawer (`--nested-drawers` 0 → peek/shrink 0, scale 1), so a plain drawer
// just slides; a drawer with nested children behind it scales down and peeks out.
// Underscores in arbitrary values become spaces — required around calc `+`/`-`.
const drawerPopupBaseClass = cn(
  'group/popup pointer-events-auto relative z-50 box-border flex flex-col overflow-y-auto outline-none will-change-transform',
  'border-border1 bg-surface3 text-neutral5 shadow-dialog',
  '[--bleed:3rem] [--peek:1rem] [--stack-step:0.05]',
  '[--stack-progress:clamp(0,var(--drawer-swipe-progress,0),1)]',
  '[--stack-peek-offset:max(0px,calc((var(--nested-drawers,0)_-_var(--stack-progress))*var(--peek)))]',
  '[--stack-scale:calc(max(0,calc(1_-_(var(--nested-drawers,0)*var(--stack-step))))_+_(var(--stack-step)*var(--stack-progress)))]',
  '[--stack-shrink:calc(1_-_var(--stack-scale))]',
  '[--stack-height:max(0px,calc(var(--drawer-frontmost-height,var(--drawer-height,0px))_-_var(--bleed)))]',
  'transition-[transform,height,opacity] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0',
  'data-[swiping]:select-none data-[swiping]:duration-0 data-[nested-drawer-swiping]:duration-0',
  'data-[ending-style]:duration-[calc(var(--drawer-swipe-strength,1)*400ms)]',
  // Dim layer drawn over a parent drawer while a nested drawer covers it.
  "after:pointer-events-none after:absolute after:inset-0 after:bg-transparent after:transition-[background-color] after:duration-[450ms] after:content-['']",
  'data-[nested-drawer-open]:after:bg-black/25',
);

// Per-side layout + motion. Top/bottom sheets bleed 3rem past the viewport edge
// (`-mb-12`/`pb-12`) so a stacked parent's border stays flush as it peeks behind.
const popupSideClasses: Record<DrawerSide, string> = {
  bottom: cn(
    'h-[var(--drawer-height,auto)] max-h-[calc(85vh_+_3rem)] w-[calc(100%_+_2px)] -mx-px -mb-12 pb-12 rounded-t-xl border-x border-t',
    '[transform-origin:50%_calc(100%_-_var(--bleed))]',
    '[transform:translateY(calc(var(--drawer-snap-point-offset,0px)_+_var(--drawer-swipe-movement-y,0px)_-_var(--stack-peek-offset)_-_(var(--stack-shrink)*var(--stack-height))))_scale(var(--stack-scale))]',
    'data-[starting-style]:[transform:translateY(calc(100%_-_var(--bleed)_+_2px))]',
    'data-[ending-style]:[transform:translateY(calc(100%_-_var(--bleed)_+_2px))]',
    'data-[nested-drawer-open]:[height:calc(var(--stack-height)_+_var(--bleed))] data-[nested-drawer-open]:overflow-hidden',
  ),
  top: cn(
    'h-[var(--drawer-height,auto)] max-h-[calc(85vh_+_3rem)] w-[calc(100%_+_2px)] -mx-px -mt-12 pt-12 rounded-b-xl border-x border-b',
    '[transform-origin:50%_var(--bleed)]',
    '[transform:translateY(calc(var(--drawer-swipe-movement-y,0px)_+_var(--stack-peek-offset)_+_(var(--stack-shrink)*var(--stack-height))))_scale(var(--stack-scale))]',
    'data-[starting-style]:[transform:translateY(calc(-100%_+_var(--bleed)_-_2px))]',
    'data-[ending-style]:[transform:translateY(calc(-100%_+_var(--bleed)_-_2px))]',
    'data-[nested-drawer-open]:[height:calc(var(--stack-height)_+_var(--bleed))] data-[nested-drawer-open]:overflow-hidden',
  ),
  left: cn(
    'h-full w-[20rem] max-w-[85vw] rounded-r-xl border-y border-r',
    '[transform:translateX(var(--drawer-swipe-movement-x,0px))]',
    'data-[starting-style]:[transform:translateX(-100%)] data-[ending-style]:[transform:translateX(-100%)]',
  ),
  right: cn(
    'h-full w-[20rem] max-w-[85vw] rounded-l-xl border-y border-l',
    '[transform:translateX(var(--drawer-swipe-movement-x,0px))]',
    'data-[starting-style]:[transform:translateX(100%)] data-[ending-style]:[transform:translateX(100%)]',
  ),
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

// Faded out while a nested drawer is open so the collapsed parent reads as a backdrop.
const nestedFadeClass = cn(
  'transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:duration-0',
  'group-data-[nested-drawer-open]/popup:opacity-0',
);

const HandleBar = () => <div className={cn('mx-auto my-2 h-1 w-12 shrink-0 rounded-full bg-surface5', nestedFadeClass)} />;

/**
 * Convenience composition of Portal + Backdrop + Viewport + Popup + Base UI `Content`.
 * The `Content` element is what lets the drawer be dragged from anywhere on the panel
 * (not just the handle) while still allowing mouse text selection of its children.
 * For layouts that need their own structure, compose the styled parts
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
            {showHandle && side === 'bottom' && <HandleBar />}
            <DrawerPrimitive.Content
              data-slot="drawer-content"
              className={cn('relative flex min-h-0 flex-1 flex-col', nestedFadeClass)}
            >
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
            </DrawerPrimitive.Content>
            {showHandle && side === 'top' && <HandleBar />}
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
