import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/ds/components/Button';
import { asChildRenderProps } from '@/lib/as-child';
import { cn } from '@/lib/utils';

import './dialog.css';

const Dialog = DialogPrimitive.Root;

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

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    className={cn('dialog-overlay-anim fixed inset-0 z-50 bg-overlay backdrop-blur-xs', className)}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, 'className'> & {
  className?: string;
  showOverlay?: boolean;
  overlayClassName?: string;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showOverlay = true, overlayClassName, ...props }, ref) => (
    <DialogPortal>
      {showOverlay && <DialogOverlay className={overlayClassName} />}
      <DialogPrimitive.Popup
        ref={ref}
        data-slot="dialog-content"
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
  ),
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-0.5 px-4 py-3 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-1.5 px-4 py-2.5 sm:flex-row sm:justify-end', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('max-h-[50vh] overflow-y-auto px-4 py-3.5', className)} {...props} />
);
DialogBody.displayName = 'DialogBody';

type DialogTitleProps = Omit<DialogPrimitive.Title.Props, 'className'> & {
  className?: string;
};

const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-ui-md font-medium', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

type DialogDescriptionProps = Omit<DialogPrimitive.Description.Props, 'className'> & {
  className?: string;
};

const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Description ref={ref} className={cn('sr-only', className)} {...props} />
  ),
);
DialogDescription.displayName = 'DialogDescription';

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
};
