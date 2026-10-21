import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { DialogAction } from './dialog-action';
import { DialogContext, dialogActionLayoutClasses, dialogActionSizeClasses, useDialogContext } from './dialog-context';
import type { DialogIntent } from './dialog-context';
import { DIALOG_DRAWER_BREAKPOINT_PX, dialogContentSizeClasses, dialogPopupClassName } from './dialog-shell';
import type { DialogSize } from './dialog-shell';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { Drawer, DrawerContent } from '@/ds/components/Drawer';
import type { DrawerProps } from '@/ds/components/Drawer';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';

import './dialog.css';

type DialogOpenChangeDetails = Parameters<NonNullable<DialogPrimitive.Root.Props['onOpenChange']>>[1];
type DrawerOpenChangeDetails = Parameters<NonNullable<DrawerProps['onOpenChange']>>[1];

export type DialogProps = Omit<DialogPrimitive.Root.Props, 'handle' | 'onOpenChange'> & {
  intent?: DialogIntent;
  pending?: boolean;
  /** `details` comes from the bottom drawer on phones, where a swipe can also close it. */
  onOpenChange?: (open: boolean, details: DialogOpenChangeDetails | DrawerOpenChangeDetails) => void;
};

const useIsDrawer = () => useIsMobile(DIALOG_DRAWER_BREAKPOINT_PX);

// Below 640px every dialog is a bottom drawer. Open state lives here so crossing the breakpoint keeps it open.
function Dialog({
  intent = 'default',
  pending = false,
  open,
  defaultOpen = false,
  onOpenChange,
  disablePointerDismissal,
  ...props
}: DialogProps) {
  const isDrawer = useIsDrawer();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const rootProps = {
    ...props,
    open: open ?? uncontrolledOpen,
    disablePointerDismissal: disablePointerDismissal ?? intent === 'destructive',
  };

  function handleOpenChange(nextOpen: boolean, details: DialogOpenChangeDetails | DrawerOpenChangeDetails) {
    if (!nextOpen && pending) {
      details.cancel();
      return;
    }
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen, details);
  }

  return (
    <DialogContext.Provider value={{ intent, pending, isDrawer }}>
      {isDrawer ? (
        <Drawer {...rootProps} onOpenChange={handleOpenChange} />
      ) : (
        <DialogPrimitive.Root {...rootProps} onOpenChange={handleOpenChange} />
      )}
    </DialogContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

type DialogOverlayProps = Omit<DialogPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn('dialog-backdrop-motion fixed inset-0 z-50 bg-scrim backdrop-blur-xs', className)}
      {...props}
    />
  );
}

export type { DialogSize };

// No `render` or function `style`: the popup is a Dialog or a Drawer, and their state callbacks differ.
type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className' | 'render' | 'style'> & {
  className?: string;
  style?: React.CSSProperties;
  size?: DialogSize;
  showOverlay?: boolean;
  showCloseButton?: boolean;
  overlayClassName?: string;
};

function DialogContent({
  className,
  children,
  size = 'md',
  showOverlay = true,
  showCloseButton = true,
  overlayClassName,
  initialFocus,
  ...props
}: DialogContentProps) {
  const { intent, pending, isDrawer } = useDialogContext();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const isDestructive = intent === 'destructive';
  const popupProps = {
    'data-slot': 'dialog-content',
    'data-size': size,
    'data-intent': intent,
    role: isDestructive ? 'alertdialog' : 'dialog',
    initialFocus: initialFocus ?? (isDestructive && showCloseButton ? closeRef : true),
    'aria-busy': pending || undefined,
    ...props,
  };
  const closeButton = showCloseButton && (
    <DialogPrimitive.Close
      ref={closeRef}
      disabled={pending}
      data-slot="dialog-close"
      className={cn('absolute right-4', isDrawer ? 'top-1.5' : 'top-4')}
      render={
        <Button variant="ghost" size="icon-sm" aria-label="Close">
          <X />
        </Button>
      }
    />
  );

  if (isDrawer) {
    return (
      <DrawerContent
        {...popupProps}
        showCloseButton={false}
        className={cn(
          'pb-3',
          size === 'full' && 'h-[calc(85vh+3rem)]',
          showCloseButton && '[&_[data-slot=dialog-header]]:pr-12',
          className,
        )}
      >
        {children}
        {closeButton}
        {/* Fills the drawer's 3rem swipe bleed below the screen edge; an element so call-site padding can't shrink it. */}
        <div aria-hidden className="h-12 shrink-0" />
      </DrawerContent>
    );
  }

  return (
    <DialogPortal>
      {showOverlay && <DialogOverlay className={overlayClassName} />}
      <DialogPrimitive.Popup
        {...popupProps}
        className={cn(
          dialogPopupClassName,
          dialogContentSizeClasses[size],
          showCloseButton && '[&_[data-slot=dialog-header]]:pr-12',
          className,
        )}
      >
        {children}
        {closeButton}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex min-w-0 shrink-0 flex-col gap-1 px-5 py-2', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 py-2', className)}
      {...props}
    />
  );
}

export type DialogBodyProps = React.ComponentProps<'div'> & {
  /** `scroll` fades and scrolls long content; `fill` takes the remaining height and leaves scrolling to its children. */
  layout?: 'scroll' | 'fill';
  /** Drops the inset so content such as split panes or code reaches the dialog's edges. */
  flush?: boolean;
};

function DialogBody({ className, layout = 'scroll', flush = false, children, ...props }: DialogBodyProps) {
  const bodyClassName = cn(
    'flex min-w-0 flex-col gap-4 text-body wrap-break-word text-muted-foreground',
    !flush && 'px-5 py-2',
    className,
  );
  if (layout === 'fill') {
    return (
      <div data-slot="dialog-body" className={cn('min-h-0 flex-1', bodyClassName)} {...props}>
        {children}
      </div>
    );
  }
  return (
    <ScrollArea className="flex min-h-0 min-w-0 flex-1 flex-col" mask>
      <ScrollAreaViewport className="h-auto min-h-0">
        <div data-slot="dialog-body" className={bodyClassName} {...props}>
          {children}
        </div>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}

type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className'> & {
  className?: string;
};

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <DialogPrimitive.Title className={cn('text-heading wrap-break-word text-foreground', className)} {...props} />;
}

type DialogDescriptionProps = Omit<DialogPrimitive.Description.Props, 'className'> & {
  className?: string;
};

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn('text-body wrap-break-word text-muted-foreground', className)}
      {...props}
    />
  );
}

type DialogCancelProps = DialogPrimitive.Close.Props & { size?: TextButtonSize };

function DialogCancel({ disabled, size = 'md', ...props }: DialogCancelProps) {
  const { pending } = useDialogContext();
  return (
    <DialogPrimitive.Close
      render={
        <Button
          size={size}
          variant="ghost"
          className={cn(dialogActionLayoutClasses, dialogActionSizeClasses[size])}
          children={props.children}
        />
      }
      {...props}
      disabled={disabled || pending}
    />
  );
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogBody,
  DialogTitle,
  DialogDescription,
  DialogCancel,
  DialogAction,
};
