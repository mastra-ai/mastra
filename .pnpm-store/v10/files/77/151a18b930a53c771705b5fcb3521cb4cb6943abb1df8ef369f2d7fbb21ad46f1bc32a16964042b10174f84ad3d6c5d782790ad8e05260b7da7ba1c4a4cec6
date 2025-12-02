// src/ui/base/dialog.tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import classNames from "classnames";
import { forwardRef } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var Dialog = DialogPrimitive.Root;
var DialogTrigger = DialogPrimitive.Trigger;
var DialogPortal = DialogPrimitive.Portal;
var DialogClose = DialogPrimitive.Close;
var DialogOverlay = forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  DialogPrimitive.Overlay,
  {
    ref,
    className: classNames("aui-dialog-overlay", className),
    ...props
  }
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
var DialogContent = forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxs(DialogPortal, { children: [
  /* @__PURE__ */ jsx(DialogOverlay, {}),
  /* @__PURE__ */ jsx(
    DialogPrimitive.Content,
    {
      ref,
      className: classNames("aui-dialog-content", className),
      ...props,
      children
    }
  )
] }));
DialogContent.displayName = DialogPrimitive.Content.displayName;
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTrigger
};
//# sourceMappingURL=dialog.mjs.map