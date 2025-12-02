// src/ui/base/button.tsx
import { cva } from "class-variance-authority";
import { Primitive } from "@radix-ui/react-primitive";
import { forwardRef } from "react";
import { jsx } from "react/jsx-runtime";
var buttonVariants = cva("aui-button", {
  variants: {
    variant: {
      default: "aui-button-primary",
      outline: "aui-button-outline",
      ghost: "aui-button-ghost"
    },
    size: {
      default: "aui-button-medium",
      icon: "aui-button-icon"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});
var Button = forwardRef(
  ({ className, variant, size, ...props }, ref) => {
    return /* @__PURE__ */ jsx(
      Primitive.button,
      {
        className: buttonVariants({ variant, size, className }),
        ...props,
        ref
      }
    );
  }
);
Button.displayName = "Button";
export {
  Button,
  buttonVariants
};
//# sourceMappingURL=button.mjs.map