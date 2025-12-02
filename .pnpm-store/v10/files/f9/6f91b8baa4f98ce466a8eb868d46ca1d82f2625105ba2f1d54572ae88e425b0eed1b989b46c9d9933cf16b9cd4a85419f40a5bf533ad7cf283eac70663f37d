import * as DialogPrimitive from "@radix-ui/react-dialog";

import classNames from "classnames";
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  ComponentRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={classNames("aui-dialog-overlay", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
  ComponentRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={classNames("aui-dialog-content", className)}
      {...props}
    >
      {children}
      {/* <DialogPrimitive.Close className="ring-offset-aui-background focus:ring-aui-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
        <XIcon className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close> */}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

// const DialogHeader = ({
//   className,
//   ...props
// }: HTMLAttributes<HTMLDivElement>) => (
//   <div
//     className={classNames(
//       "flex flex-col space-y-1.5 text-center sm:text-left",
//       className,
//     )}
//     {...props}
//   />
// );
// DialogHeader.displayName = "DialogHeader";

// const DialogFooter = ({
//   className,
//   ...props
// }: HTMLAttributes<HTMLDivElement>) => (
//   <div
//     className={classNames(
//       "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
//       className,
//     )}
//     {...props}
//   />
// );
// DialogFooter.displayName = "DialogFooter";

// const DialogTitle = forwardRef<
//   ComponentRef<typeof DialogPrimitive.Title>,
//   ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
// >(({ className, ...props }, ref) => (
//   <DialogPrimitive.Title
//     ref={ref}
//     className={classNames(
//       "text-lg font-semibold leading-none tracking-tight",
//       className,
//     )}
//     {...props}
//   />
// ));
// DialogTitle.displayName = DialogPrimitive.Title.displayName;

// const DialogDescription = forwardRef<
//   ComponentRef<typeof DialogPrimitive.Description>,
//   ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
// >(({ className, ...props }, ref) => (
//   <DialogPrimitive.Description
//     ref={ref}
//     className={classNames("text-muted-foreground text-sm", className)}
//     {...props}
//   />
// ));
// DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  // DialogHeader,
  // DialogFooter,
  // DialogTitle,
  // DialogDescription,
};
