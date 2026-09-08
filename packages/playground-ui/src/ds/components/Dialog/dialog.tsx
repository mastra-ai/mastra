import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { DialogAction } from './dialog-action';
import { DialogContext, dialogActionLayoutClasses, dialogActionSizeClasses, useDialogContext } from './dialog-context';
import type { DialogIntent, DialogVariant } from './dialog-context';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { asChildRenderProps } from '@/lib/as-child';
import { cn } from '@/lib/utils';

import './dialog.css';

export type DialogProps = DialogPrimitive.Root.Props & {
  variant?: DialogVariant;
  intent?: DialogIntent;
  pending?: boolean;
};

function Dialog({ variant = 'default', intent = 'default', pending = false, onOpenChange, ...props }: DialogProps) {
  const isNew = variant === 'new';
  return (
    <DialogContext.Provider value={{ variant, intent, pending }}>
      <DialogPrimitive.Root
        {...props}
        disablePointerDismissal={props.disablePointerDismissal ?? (isNew && intent === 'destructive')}
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

type DialogTriggerProps = DialogPrimitive.Trigger.Props & {
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
};

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    return (
      <DialogPrimitive.Trigger ref={ref} {...asChildRenderProps(asChild, children)} {...props}>
        {asChild ? undefined : children}
      </DialogPrimitive.Trigger>
    );
  },
);
DialogTrigger.displayName = 'DialogTrigger';

const DialogPortal = DialogPrimitive.Portal;

type DialogCloseProps = DialogPrimitive.Close.Props & {
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
};

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(({ asChild, children, ...props }, ref) => {
  return (
    <DialogPrimitive.Close ref={ref} {...asChildRenderProps(asChild, children)} {...props}>
      {asChild ? undefined : children}
    </DialogPrimitive.Close>
  );
});
DialogClose.displayName = 'DialogClose';

type DialogOverlayProps = Omit<DialogPrimitive.Backdrop.Props, 'className'> & {
  className?: string;
};

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(({ className, ...props }, ref) => {
  const { variant } = useDialogContext();
  return (
    <DialogPrimitive.Backdrop
      ref={ref}
      className={cn(
        variant === 'new'
          ? 'transition-opacity duration-normal ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none'
          : 'dialog-overlay-anim',
        'fixed inset-0 z-50 bg-overlay backdrop-blur-xs',
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = 'DialogOverlay';

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
  showOverlay?: boolean;
  overlayClassName?: string;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showOverlay = true, overlayClassName, initialFocus, ...props }, ref) => {
    const { variant, intent, pending } = useDialogContext();
    const closeRef = React.useRef<HTMLButtonElement>(null);
    if (variant === 'new') {
      return (
        <DialogPortal>
          {showOverlay && <DialogOverlay className={overlayClassName} />}
          <DialogPrimitive.Popup
            ref={ref}
            data-slot="dialog-content"
            data-variant="new"
            data-intent={intent}
            role={intent === 'destructive' ? 'alertdialog' : 'dialog'}
            initialFocus={initialFocus ?? (intent === 'destructive' ? closeRef : true)}
            aria-busy={pending || undefined}
            className={cn(
              'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm translate-[-50%] flex-col overflow-y-auto overscroll-contain rounded-xl border border-border1/40 bg-surface2 shadow-dialog outline-hidden',
              'data-[ending-style]:scale-0.98 data-[starting-style]:scale-0.98 transition-[opacity,scale] duration-normal ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none',
              className,
            )}
            {...props}
          >
            {children}
            <DialogPrimitive.Close
              ref={closeRef}
              disabled={pending}
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-3 right-3"
                  aria-label="Close dialog"
                  children={<X />}
                />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </DialogPrimitive.Popup>
        </DialogPortal>
      );
    }
    return (
      <DialogPortal>
        {showOverlay && <DialogOverlay className={overlayClassName} />}
        <DialogPrimitive.Popup
          ref={ref}
          data-slot="dialog-content"
          initialFocus={initialFocus}
          className={cn(
            'dialog-content-anim',
            'fixed top-[50%] left-[50%] z-50 grid translate-[-50%]',
            'w-full max-w-[calc(100%-2rem)] sm:max-w-lg',
            'rounded-xl border border-border1/40 bg-surface2/96 shadow-dialog backdrop-blur-md',
            'focus-visible:outline-hidden',
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            render={
              <Button variant="ghost" size="sm" className="absolute top-3 right-3" aria-label="Close">
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

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const { variant } = useDialogContext();
  return (
    <div
      className={cn(
        variant === 'new'
          ? 'flex min-w-0 shrink-0 flex-col gap-2 px-5 pt-4 pb-2'
          : 'flex flex-col gap-0.5 px-4 py-3 text-left',
        className,
      )}
      {...props}
    />
  );
};
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const { variant } = useDialogContext();
  return (
    <div
      className={cn(
        variant === 'new'
          ? 'flex shrink-0 flex-wrap justify-end gap-2 px-5 pt-2 pb-4'
          : 'flex flex-col-reverse gap-1.5 px-4 py-2.5 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
};
DialogFooter.displayName = 'DialogFooter';

const DialogBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { variant } = useDialogContext();
    if (variant === 'new') {
      return (
        <ScrollArea className="flex min-h-0 min-w-0 shrink flex-col" viewPortClassName="h-auto min-h-0" mask>
          <div
            ref={ref}
            className={cn(
              'flex flex-col gap-4 px-5 py-2 text-ui-md leading-ui-md [overflow-wrap:anywhere] text-neutral4',
              className,
            )}
            {...props}
          >
            {children}
          </div>
        </ScrollArea>
      );
    }
    return (
      <div ref={ref} className={cn('max-h-[50vh] overflow-y-auto px-4 py-3.5', className)} {...props}>
        {children}
      </div>
    );
  },
);
DialogBody.displayName = 'DialogBody';

type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className'> & {
  className?: string;
};

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(({ className, ...props }, ref) => {
  const { variant } = useDialogContext();
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        'text-ui-md font-medium',
        variant === 'new' && 'pr-8 leading-ui-md [overflow-wrap:anywhere] text-neutral6',
        className,
      )}
      {...props}
    />
  );
});
DialogTitle.displayName = 'DialogTitle';

type DialogDescriptionProps = Omit<DialogPrimitive.Description.Props, 'className'> & {
  className?: string;
};

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => {
    const { variant } = useDialogContext();
    return (
      <DialogPrimitive.Description
        ref={ref}
        className={cn(
          variant === 'new' ? 'text-ui-md leading-ui-md [overflow-wrap:anywhere] text-neutral4' : 'sr-only',
          className,
        )}
        {...props}
      />
    );
  },
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
