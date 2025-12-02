"use client";

// src/primitives/composer/ComposerRoot.tsx
import { composeEventHandlers } from "@radix-ui/primitive";
import { Primitive } from "@radix-ui/react-primitive";
import {
  forwardRef
} from "react";
import { useComposerSend } from "./ComposerSend.js";
import { jsx } from "react/jsx-runtime";
var ComposerPrimitiveRoot = forwardRef(({ onSubmit, ...rest }, forwardedRef) => {
  const send = useComposerSend();
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!send) return;
    send();
  };
  return /* @__PURE__ */ jsx(
    Primitive.form,
    {
      ...rest,
      ref: forwardedRef,
      onSubmit: composeEventHandlers(onSubmit, handleSubmit)
    }
  );
});
ComposerPrimitiveRoot.displayName = "ComposerPrimitive.Root";
export {
  ComposerPrimitiveRoot
};
//# sourceMappingURL=ComposerRoot.js.map