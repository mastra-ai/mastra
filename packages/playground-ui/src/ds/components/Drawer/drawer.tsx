import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

// Swipe/stack transforms live in drawer.css — unreadable as Tailwind arbitrary values.
import './drawer.css';

export type DrawerSide = 'top' | 'right' | 'bottom' | 'left';

const drawerBackdropVariants = cva('drawer-backdrop fixed inset-0 z-50', {
  variants: {
    overlay: {
      visible: 'bg-overlay backdrop-blur-xs',
      transparent: 'bg-transparent',
      none: 'hidden',
    },
  },
  defaultVariants: {
    overlay: 'visible',
  },
});

const drawerViewportVariants = cva('fixed z-50 flex', {
  variants: {
    side: {
      top: 'items-start justify-center',
      bottom: 'items-end justify-center',
      left: 'items-stretch justify-start',
      right: 'items-stretch justify-end',
    },
    layout: {
      default: 'inset-0',
      floating: 'p-3 sm:p-4',
      floatingOverlay: 'inset-0 p-3 sm:p-4',
    },
  },
  compoundVariants: [
    {
      side: 'right',
      layout: 'floating',
      className: 'inset-y-0 right-0 w-[calc(32rem+1.5rem)] max-w-full sm:w-[calc(32rem+2rem)]',
    },
    {
      side: 'left',
      layout: 'floating',
      className: 'inset-y-0 left-0 w-[calc(32rem+1.5rem)] max-w-full sm:w-[calc(32rem+2rem)]',
    },
    {
      side: 'bottom',
      layout: 'floating',
      className: 'inset-x-0 bottom-0 h-[calc(85dvh+1.5rem)] max-h-full sm:h-[calc(85dvh+2rem)]',
    },
    {
      side: 'top',
      layout: 'floating',
      className: 'inset-x-0 top-0 h-[calc(85dvh+1.5rem)] max-h-full sm:h-[calc(85dvh+2rem)]',
    },
  ],
  defaultVariants: {
    side: 'bottom',
    layout: 'default',
  },
});

// `drawer-popup` hooks into drawer.css for swipe/stack transforms; `::after` dims under nested drawers.
const drawerPopupVariants = cva(
  cn(
    'drawer-popup group/popup relative z-50 box-border flex [touch-action:auto] flex-col overflow-y-auto overscroll-contain will-change-transform outline-none',
    'border-border1 bg-surface3 text-neutral5 shadow-dialog',
    'data-[swiping]:select-none',
    "after:pointer-events-none after:absolute after:inset-0 after:bg-transparent after:transition-[background-color] after:duration-[450ms] after:content-['']",
    'data-[nested-drawer-open]:after:bg-black/25',
  ),
  {
    variants: {
      side: {
        bottom: '',
        top: '',
        left: '',
        right: '',
      },
      variant: {
        default: '',
        floating: 'drawer-popup-floating pointer-events-auto rounded-lg border',
      },
    },
    compoundVariants: [
      {
        side: 'bottom',
        variant: 'default',
        className:
          'h-[var(--drawer-height,auto)] max-h-[calc(85vh_+_3rem)] w-full -mb-12 pb-12 rounded-t-xl border-x border-t',
      },
      {
        side: 'top',
        variant: 'default',
        className:
          'h-[var(--drawer-height,auto)] max-h-[calc(85vh_+_3rem)] w-full -mt-12 pt-12 rounded-b-xl border-x border-b',
      },
      {
        side: 'left',
        variant: 'default',
        className: 'h-full w-[20rem] max-w-[85vw] rounded-r-xl border-y border-r',
      },
      {
        side: 'right',
        variant: 'default',
        className: 'h-full w-[20rem] max-w-[85vw] rounded-l-xl border-y border-l',
      },
      {
        side: ['left', 'right'],
        variant: 'floating',
        className:
          'h-[calc(100dvh-1.5rem)] w-[32rem] max-w-[calc(100vw-1.5rem)] sm:h-[calc(100dvh-2rem)] sm:max-w-[calc(100vw-2rem)]',
      },
      {
        side: ['top', 'bottom'],
        variant: 'floating',
        className:
          'max-h-[calc(85dvh-1.5rem)] w-[calc(100vw-1.5rem)] sm:max-h-[calc(85dvh-2rem)] sm:w-[calc(100vw-2rem)]',
      },
    ],
    defaultVariants: {
      side: 'bottom',
      variant: 'default',
    },
  },
);

type DrawerBackdropVariantsProps = VariantProps<typeof drawerBackdropVariants>;
type DrawerViewportClassVariantsProps = VariantProps<typeof drawerViewportVariants>;
type DrawerPopupVariantsProps = VariantProps<typeof drawerPopupVariants>;
export type DrawerVariant = NonNullable<DrawerPopupVariantsProps['variant']>;
type DrawerViewportLayout = NonNullable<DrawerViewportClassVariantsProps['layout']>;
type DrawerViewportVariantsProps = Pick<DrawerViewportClassVariantsProps, 'side'> & {
  variant?: DrawerVariant;
};
export type DrawerOverlay = 'auto' | NonNullable<DrawerBackdropVariantsProps['overlay']>;

// `side` = anchor edge; Base UI's `swipeDirection` = dismissal gesture (bottom sheet swipes `down`).
const sideToSwipeDirection: Record<DrawerSide, 'up' | 'down' | 'left' | 'right'> = {
  top: 'up',
  bottom: 'down',
  left: 'left',
  right: 'right',
};

type DrawerContextValue = {
  side: DrawerSide;
  variant: DrawerVariant;
  resolvedOverlay: NonNullable<DrawerBackdropVariantsProps['overlay']>;
};

const resolveDrawerOverlay = (
  overlay: DrawerOverlay,
  variant: DrawerVariant,
): NonNullable<DrawerBackdropVariantsProps['overlay']> => {
  if (overlay !== 'auto') {
    return overlay;
  }

  return variant === 'floating' ? 'none' : 'visible';
};

const DrawerContext = React.createContext<DrawerContextValue>({
  side: 'bottom',
  variant: 'default',
  resolvedOverlay: 'visible',
});

const useDrawerContext = () => React.useContext(DrawerContext);

export const useDrawerSide = () => useDrawerContext().side;

const resolveDrawerViewportLayout = (
  variant: DrawerVariant,
  overlay: NonNullable<DrawerBackdropVariantsProps['overlay']>,
): DrawerViewportLayout => {
  if (variant !== 'floating') {
    return 'default';
  }

  return overlay === 'none' ? 'floating' : 'floatingOverlay';
};

export type DrawerProps<Payload = unknown> = Omit<DrawerPrimitive.Root.Props<Payload>, 'swipeDirection'> & {
  /** Edge the drawer is anchored to. Defaults to `bottom`. */
  side?: DrawerSide;
  /** Visual treatment for the drawer panel. Defaults to `default`. */
  variant?: DrawerVariant;
  /** Backdrop behavior. `auto` renders a visible backdrop for default drawers and no backdrop for floating drawers. */
  overlay?: DrawerOverlay;
};

function Drawer<Payload = unknown>({
  side = 'bottom',
  variant = 'default',
  overlay = 'auto',
  modal,
  disablePointerDismissal,
  children,
  ...props
}: DrawerProps<Payload>) {
  const resolvedOverlay = resolveDrawerOverlay(overlay, variant);
  const resolvedModal = modal ?? (resolvedOverlay === 'none' ? false : undefined);
  const resolvedDisablePointerDismissal = disablePointerDismissal ?? (resolvedOverlay === 'none' ? true : undefined);
  const contextValue = React.useMemo<DrawerContextValue>(
    () => ({ side, variant, resolvedOverlay }),
    [side, variant, resolvedOverlay],
  );

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        swipeDirection={sideToSwipeDirection[side]}
        modal={resolvedModal}
        disablePointerDismissal={resolvedDisablePointerDismissal}
        {...props}
      >
        {children}
      </DrawerPrimitive.Root>
    </DrawerContext.Provider>
  );
}
Drawer.displayName = 'Drawer';

// Generic (not `forwardRef`) so `handle` / `payload` stay type-safe on detached triggers.
type DrawerTriggerProps<Payload = unknown> = DrawerPrimitive.Trigger.Props<Payload> & {
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
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
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
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
} & DrawerBackdropVariantsProps;

// The `drawer-backdrop` class (drawer.css) fades the overlay with the swipe gesture.
const DrawerBackdrop = React.forwardRef<HTMLDivElement, DrawerBackdropProps>(
  ({ className, overlay, ...props }, ref) => {
    const { resolvedOverlay } = useDrawerContext();
    const resolvedBackdropOverlay = overlay ?? resolvedOverlay;

    return (
      <DrawerPrimitive.Backdrop
        ref={ref}
        data-slot="drawer-backdrop"
        data-overlay={resolvedBackdropOverlay}
        className={cn(drawerBackdropVariants({ overlay: resolvedBackdropOverlay }), className)}
        {...props}
      />
    );
  },
);
DrawerBackdrop.displayName = 'DrawerBackdrop';

type DrawerViewportProps = Omit<DrawerPrimitive.Viewport.Props, 'className'> & {
  className?: string;
} & DrawerViewportVariantsProps;

// Keep the viewport pointer-interactive: Base UI wires native drag-to-dismiss to it.
// Floating drawers without an overlay constrain the viewport so the page behind stays interactive.
// Floating drawers with an overlay keep a full-screen viewport so overlay-start drags stay native.
const DrawerViewport = React.forwardRef<HTMLDivElement, DrawerViewportProps>(
  ({ className, side, variant, ...props }, ref) => {
    const context = useDrawerContext();
    const resolvedSide = side ?? context.side;
    const resolvedVariant = variant ?? context.variant;
    const layout = resolveDrawerViewportLayout(resolvedVariant, context.resolvedOverlay);

    return (
      <DrawerPrimitive.Viewport
        ref={ref}
        data-slot="drawer-viewport"
        data-variant={resolvedVariant}
        className={cn(drawerViewportVariants({ side: resolvedSide, layout }), className)}
        {...props}
      />
    );
  },
);
DrawerViewport.displayName = 'DrawerViewport';

type DrawerPopupProps = Omit<DrawerPrimitive.Popup.Props, 'className'> & {
  className?: string;
} & DrawerPopupVariantsProps;

const DrawerPopup = React.forwardRef<HTMLDivElement, DrawerPopupProps>(
  ({ className, side, variant, ...props }, ref) => {
    const context = useDrawerContext();
    const resolvedSide = side ?? context.side;
    const resolvedVariant = variant ?? context.variant;

    return (
      <DrawerPrimitive.Popup
        ref={ref}
        data-slot="drawer-popup"
        data-variant={resolvedVariant}
        className={cn(drawerPopupVariants({ side: resolvedSide, variant: resolvedVariant }), className)}
        {...props}
      />
    );
  },
);
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

type DrawerFloatingSideHandleProps = {
  side: DrawerSide;
  variant: DrawerVariant;
};

const DrawerFloatingSideHandle = ({ side, variant }: DrawerFloatingSideHandleProps) => {
  if (variant !== 'floating' || (side !== 'left' && side !== 'right')) {
    return null;
  }

  return (
    <div
      aria-hidden
      data-slot="drawer-side-handle"
      className={cn(
        'absolute top-1/2 z-10 flex h-20 w-5 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center select-none lg:hidden',
        side === 'right' ? '-left-2' : '-right-2',
      )}
    >
      <div className="h-10 w-1 rounded-full bg-surface5/80 shadow-sm" />
    </div>
  );
};
DrawerFloatingSideHandle.displayName = 'DrawerFloatingSideHandle';

type DrawerContentProps = Omit<DrawerPrimitive.Popup.Props, 'className' | 'children'> & {
  className?: string;
  children?: React.ReactNode;
  /** Shows the built-in top-right close button. Defaults to `true`. */
  showCloseButton?: boolean;
} & Pick<DrawerPopupVariantsProps, 'variant'>;

// Opinionated bundle: Portal + Backdrop + Viewport + Popup, with handle on top/bottom sheets.
// Drop to the primitives for non-modal pages, custom portal targets, or chrome outside the popup.
const DrawerContent = React.forwardRef<HTMLDivElement, DrawerContentProps>(
  ({ className, children, variant, showCloseButton = true, ...props }, ref) => {
    const { side, variant: contextVariant, resolvedOverlay } = useDrawerContext();
    const resolvedVariant = variant ?? contextVariant;
    const showHandle = side === 'top' || side === 'bottom';

    return (
      <DrawerPortal>
        {resolvedOverlay !== 'none' && <DrawerBackdrop />}
        <DrawerViewport variant={resolvedVariant}>
          <DrawerPopup ref={ref} variant={resolvedVariant} className={className} {...props}>
            {showHandle && side === 'bottom' && <DrawerHandleBar />}
            <DrawerFloatingSideHandle side={side} variant={resolvedVariant} />
            <div data-slot="drawer-content" className={cn('relative flex min-h-0 flex-1 flex-col', nestedFadeClass)}>
              {showCloseButton && <DrawerDefaultCloseButton />}
              {children}
            </div>
            {showHandle && side === 'top' && <DrawerHandleBar />}
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    );
  },
);
DrawerContent.displayName = 'DrawerContent';

const DrawerDefaultCloseButton = () => (
  <DrawerClose asChild>
    <Button type="button" variant="ghost" size="icon-sm" className="absolute top-3 right-3 z-10" aria-label="Close">
      <XIcon />
    </Button>
  </DrawerClose>
);
DrawerDefaultCloseButton.displayName = 'DrawerDefaultCloseButton';

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="drawer-header"
    className={cn('flex flex-col gap-0.5 px-4 py-3 pr-12 text-left', className)}
    {...props}
  />
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
