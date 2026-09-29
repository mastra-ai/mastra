import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { DialogAction } from './dialog-action';
import { DialogContext, dialogActionLayoutClasses, dialogActionSizeClasses, useDialogContext } from './dialog-context';
import type { DialogIntent } from './dialog-context';
import { dialogContentSizeClasses, dialogOverlayClassName, dialogPopupClassName } from './dialog-shell';
import type { DialogSize } from './dialog-shell';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';

import './dialog.css';

export type DialogProps = DialogPrimitive.Root.Props & {
  intent?: DialogIntent;
  pending?: boolean;
};

function Dialog({ intent = 'default', pending = false, onOpenChange, disablePointerDismissal, ...props }: DialogProps) {
  return (
    <DialogContext.Provider value={{ intent, pending }}>
      <DialogPrimitive.Root
        {...props}
        disablePointerDismissal={disablePointerDismissal ?? intent === 'destructive'}
        onOpenChange={(open, details) => {
          if (!open && pending) {
            details.cancel();
            return;
          }
          onOpenChange?.(open, details);
        }}
      />
    </DialogContext.Provider>
  );
}

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

type DialogOverlayProps = Omit<DialogPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(dialogOverlayClassName, className)}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

export type { DialogSize };

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
  size?: DialogSize;
  showOverlay?: boolean;
  overlayClassName?: string;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, size = 'md', showOverlay = true, overlayClassName, initialFocus, ...props }, ref) => {
    const { intent, pending } = useDialogContext();
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const isDestructive = intent === 'destructive';
    return (
      <DialogPortal>
        {showOverlay && <DialogOverlay className={overlayClassName} />}
        <DialogPrimitive.Popup
          ref={ref}
          data-slot="dialog-content"
          data-size={size}
          data-intent={intent}
          role={isDestructive ? 'alertdialog' : 'dialog'}
          initialFocus={initialFocus ?? (isDestructive ? closeRef : true)}
          aria-busy={pending || undefined}
          className={cn(dialogPopupClassName, dialogContentSizeClasses[size], className)}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            ref={closeRef}
            disabled={pending}
            data-slot="dialog-close"
            className="absolute top-4 right-4"
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            }
          />
        </DialogPrimitive.Popup>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-header"
    className={cn('flex min-w-0 shrink-0 flex-col gap-1 py-2 pr-12 pl-5', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    data-slot="dialog-footer"
    className={cn('flex shrink-0 flex-wrap items-center justify-end gap-2 px-5 py-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export type DialogBodyProps = React.HTMLAttributes<HTMLDivElement> & {
  /** `scroll` fades and scrolls long content; `fill` takes the remaining height and leaves scrolling to its children. */
  layout?: 'scroll' | 'fill';
  /** Drops the inset so content such as split panes or code reaches the dialog's edges. */
  flush?: boolean;
};

const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ className, layout = 'scroll', flush = false, children, ...props }, ref) => {
    const bodyClassName = cn(
      'flex min-w-0 flex-col gap-4 text-body wrap-break-word text-muted-foreground',
      !flush && 'px-5 py-2',
      className,
    );
    if (layout === 'fill') {
      return (
        <div ref={ref} data-slot="dialog-body" className={cn('min-h-0 flex-1', bodyClassName)} {...props}>
          {children}
        </div>
      );
    }
    return (
      <ScrollArea className="flex min-h-0 min-w-0 flex-1 flex-col" viewPortClassName="h-auto min-h-0" mask>
        <div ref={ref} data-slot="dialog-body" className={bodyClassName} {...props}>
          {children}
        </div>
      </ScrollArea>
    );
  },
);
DialogBody.displayName = 'DialogBody';

type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className'> & {
  className?: string;
};

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-heading wrap-break-word text-foreground', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

type DialogDescriptionProps = Omit<DialogPrimitive.Description.Props, 'className'> & {
  className?: string;
};

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-body wrap-break-word text-muted-foreground', className)}
      {...props}
    />
  ),
);
DialogDescription.displayName = 'DialogDescription';

type DialogCancelProps = DialogPrimitive.Close.Props & { size?: TextButtonSize };

const DialogCancel = React.forwardRef<HTMLButtonElement, DialogCancelProps>(
  ({ disabled, size = 'md', ...props }, ref) => {
    const { pending } = useDialogContext();
    return (
      <DialogPrimitive.Close
        ref={ref}
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
  },
);
DialogCancel.displayName = 'DialogCancel';

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
