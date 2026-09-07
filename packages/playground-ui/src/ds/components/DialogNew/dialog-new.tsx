import { Dialog as Primitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { forwardRef, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { DialogNewAction } from './dialog-new-action';
import { DialogNewContext, useDialogNew } from './dialog-new-context';
import { Button } from '@/ds/components/Button';
import type { TextButtonSize } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';
import './dialog-new.css';

export type DialogNewProps = Primitive.Root.Props & {
  variant?: 'default' | 'destructive';
  pending?: boolean;
};

function DialogNew({ variant = 'default', pending = false, onOpenChange, ...props }: DialogNewProps) {
  return (
    <DialogNewContext.Provider value={{ variant, pending }}>
      <Primitive.Root
        {...props}
        disablePointerDismissal={props.disablePointerDismissal ?? variant === 'destructive'}
        onOpenChange={(open, details) => {
          if (!open && pending) {
            details.cancel();
            return;
          }
          onOpenChange?.(open, details);
        }}
      />
    </DialogNewContext.Provider>
  );
}

export type DialogNewContentProps = Omit<Primitive.Popup.Props, 'className'> & {
  className?: string;
};

const DialogNewContent = forwardRef<HTMLDivElement, DialogNewContentProps>(
  ({ className, children, initialFocus, ...props }, ref) => {
    const { variant, pending } = useDialogNew();
    const closeRef = useRef<HTMLButtonElement>(null);
    return (
      <Primitive.Portal>
        <Primitive.Backdrop className="dialog-new-backdrop bg-overlay fixed inset-0 z-50 backdrop-blur-xs" />
        <Primitive.Popup
          ref={ref}
          role={variant === 'destructive' ? 'alertdialog' : 'dialog'}
          initialFocus={initialFocus ?? (variant === 'destructive' ? closeRef : true)}
          aria-busy={pending || undefined}
          data-variant={variant}
          className={cn(
            'dialog-new-content fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm translate-[-50%] flex-col rounded-xl border border-border1/40 bg-surface2 shadow-dialog outline-hidden',
            className,
          )}
          {...props}
        >
          {children}
          <Primitive.Close
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
          </Primitive.Close>
        </Primitive.Popup>
      </Primitive.Portal>
    );
  },
);
DialogNewContent.displayName = 'DialogNewContent';

const DialogNewHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex min-w-0 shrink-0 flex-col gap-2 px-5 pt-4 pb-2', className)} {...props} />
));
DialogNewHeader.displayName = 'DialogNewHeader';

const DialogNewBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
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
  ),
);
DialogNewBody.displayName = 'DialogNewBody';

const DialogNewFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('dialog-new-footer flex shrink-0 flex-wrap justify-end gap-2 px-5 pt-2 pb-4', className)}
    {...props}
  />
));
DialogNewFooter.displayName = 'DialogNewFooter';

const DialogNewTitle = forwardRef<
  HTMLHeadingElement,
  Omit<Primitive.Title.Props, 'className'> & { className?: string }
>(({ className, ...props }, ref) => (
  <Primitive.Title
    ref={ref}
    className={cn('pr-8 text-ui-md leading-ui-md font-medium [overflow-wrap:anywhere] text-neutral6', className)}
    {...props}
  />
));
DialogNewTitle.displayName = 'DialogNewTitle';

const DialogNewDescription = forwardRef<
  HTMLParagraphElement,
  Omit<Primitive.Description.Props, 'className'> & { className?: string }
>(({ className, ...props }, ref) => (
  <Primitive.Description
    ref={ref}
    className={cn('text-ui-md leading-ui-md [overflow-wrap:anywhere] text-neutral4', className)}
    {...props}
  />
));
DialogNewDescription.displayName = 'DialogNewDescription';

const DialogNewCancel = forwardRef<HTMLButtonElement, Primitive.Close.Props & { size?: TextButtonSize }>(
  ({ disabled, size = 'md', ...props }, ref) => {
    const { pending } = useDialogNew();
    return (
      <Primitive.Close
        ref={ref}
        data-dialog-size={size}
        render={<Button size={size} variant="ghost" children={props.children} />}
        {...props}
        disabled={disabled || pending}
      />
    );
  },
);
DialogNewCancel.displayName = 'DialogNewCancel';

DialogNew.Trigger = Primitive.Trigger;
DialogNew.Content = DialogNewContent;
DialogNew.Header = DialogNewHeader;
DialogNew.Title = DialogNewTitle;
DialogNew.Description = DialogNewDescription;
DialogNew.Body = DialogNewBody;
DialogNew.Footer = DialogNewFooter;
DialogNew.Cancel = DialogNewCancel;
DialogNew.Action = DialogNewAction;

export { DialogNew };
